package simulation

import (
	"math/rand"
	"sync"
	"time"
)

type Engine struct {
	mu            sync.RWMutex
	config        *Config
	ctx           *PropagationContext
	gen           *LoadGenerator
	tickNum       int
	running       bool
	ticks         []Tick
	onTick        func(tick Tick, tickNum int)
	chaos         *ChaosManager
	deployment    *DeploymentManager
	RunID         string
	originalNodes []Node
}

func NewEngine(cfg *Config) *Engine {
	orig := make([]Node, len(cfg.Nodes))
	copy(orig, cfg.Nodes)
	dep := NewDeploymentManager()
	dep.InitFromNodes(cfg.Nodes)
	ctx := NewPropagationContext(cfg)
	ctx.DepManager = dep
	return &Engine{
		config:        cfg,
		ctx:           ctx,
		gen:           NewLoadGenerator(cfg.Pattern, cfg.TargetRPS),
		tickNum:       0,
		originalNodes: orig,
		deployment:    dep,
	}
}

func (e *Engine) GetDeploymentManager() *DeploymentManager {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.deployment
}

func (e *Engine) SetDeploymentManager(dm *DeploymentManager) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.deployment = dm
	e.ctx.DepManager = dm
}

func (e *Engine) SetChaosManager(cm *ChaosManager) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.chaos = cm
}

func (e *Engine) restoreNodes() {
	for i := range e.originalNodes {
		orig := &e.originalNodes[i]
		if n, ok := e.ctx.Nodes[orig.ID]; ok {
			n.IsFailed = orig.IsFailed
			n.LatencyMs = orig.LatencyMs
			n.ErrorRate = orig.ErrorRate
			n.MaxRPS = orig.MaxRPS
			// Preserve auto-scaled instance count so scaling survives tick resets
			if !n.AutoScaling.Enabled || n.LastScaleTick == 0 {
				n.Instances = orig.Instances
			}
			n.RetryCount = 0
			n.DroppedRequests = 0
			n.StaleReadCount = 0
			n.DataInconsistency = 0
			n.SpotInterrupted = false
		}
	}
	// Sync deployment state from manager into node configs
	if e.deployment != nil {
		for _, ds := range e.deployment.AllStates() {
			if n, ok := e.ctx.Nodes[ds.NodeID]; ok {
				n.Deployment.CanaryPercent = ds.CanaryPercent
				n.Deployment.IsCanaryActive = ds.CanaryActive
			}
		}
	}
}

func (e *Engine) OnTick(fn func(tick Tick, tickNum int)) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.onTick = fn
}

func (e *Engine) Start() {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return
	}
	e.running = true
	e.tickNum = 0
	e.ticks = make([]Tick, 0)
	e.mu.Unlock()

	go e.runLoop()
}

func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.running = false
}

func (e *Engine) IsRunning() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.running
}

func (e *Engine) Ticks() []Tick {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Tick, len(e.ticks))
	copy(result, e.ticks)
	return result
}

func (e *Engine) CurrentTick() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.tickNum
}

func (e *Engine) Config() *Config {
	return e.config
}

func (e *Engine) runLoop() {
	totalTicks := e.config.DurationSeconds
	if e.config.TickRateMs > 0 {
		totalTicks = e.config.DurationSeconds * 1000 / e.config.TickRateMs
	}
	totalTicksInt := totalTicks
	if totalTicksInt < 1 {
		totalTicksInt = 1
	}

	interval := time.Duration(e.config.TickRateMs) * time.Millisecond
	if interval <= 0 {
		interval = 100 * time.Millisecond
	}
	effectiveInterval := time.Duration(float64(interval) / e.config.SpeedMultiplier)
	if effectiveInterval < time.Millisecond {
		effectiveInterval = time.Millisecond
	}

	ticker := time.NewTicker(effectiveInterval)
	defer ticker.Stop()

	for range ticker.C {
		e.mu.Lock()
		if !e.running {
			e.mu.Unlock()
			return
		}

		if e.tickNum >= totalTicksInt {
			e.running = false
			e.mu.Unlock()
			return
		}

		e.tickNum++

		e.mu.Unlock()

		e.RunTick()

		e.mu.Lock()
		if e.tickNum >= totalTicksInt {
			e.running = false
		}
		e.mu.Unlock()
	}
}

func (e *Engine) RunTick() {
	e.mu.Lock()
	cfg := e.config
	ctx := e.ctx
	tickNum := e.tickNum
	cm := e.chaos
	runID := e.RunID
	e.mu.Unlock()

	totalTicks := cfg.DurationSeconds
	if cfg.TickRateMs > 0 {
		totalTicks = cfg.DurationSeconds * 1000 / cfg.TickRateMs
	}

	rps := e.gen.RPSAtTick(tickNum, int(totalTicks))

	if cm != nil {
		e.restoreNodes()
		cm.ApplyPreTick(runID, ctx.Nodes, tickNum)
	} else {
		e.restoreNodes()
	}

	applySpotInterruptions(ctx.Nodes)

	ctx.PropagateTick(rps)

	// Auto-scaling evaluates utilization metrics computed inside PropagateTick
	ApplyAutoScaling(ctx.Nodes, tickNum)

	if cm != nil {
		cm.ApplyPostTick(runID, ctx.Nodes)
	}

	tick := SnapshotTick(tickNum, cfg.Nodes, cfg.Edges, e.deployment)

	e.mu.Lock()
	e.ticks = append(e.ticks, tick)
	onTick := e.onTick
	e.mu.Unlock()

	if onTick != nil {
		onTick(tick, tickNum)
	}
}

func applySpotInterruptions(nodeMap map[string]*Node) {
	for _, n := range nodeMap {
		if n.ComputeTier == "spot" && !n.IsFailed {
			if rand.Float64() < 0.05 {
				n.IsFailed = true
				n.SpotInterrupted = true
				n.Instances = 0
				n.MaxRPS = 0
			}
		}
	}
}
