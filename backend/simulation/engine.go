package simulation

import (
	"encoding/json"
	"math/rand"
	"sync"
	"time"
)

type Engine struct {
	mu             sync.RWMutex
	config         *Config
	ctx            *PropagationContext
	gen            *LoadGenerator
	tickNum        int
	running        bool
	ticks          []Tick
	onTick         func(tick Tick, tickNum int)
	chaos          *ChaosManager
	deployment     *DeploymentManager
	RunID          string
	originalNodes  []Node
	TraceCollector *TraceCollector

	activeScenario  *IncidentScenario
	stepIndex       int
	trafficMultiplier      float64
	trafficSpikeEndTick    int
}

func NewEngine(cfg *Config) *Engine {
	orig := make([]Node, len(cfg.Nodes))
	copy(orig, cfg.Nodes)
	dep := NewDeploymentManager()
	dep.InitFromNodes(cfg.Nodes)
	ctx := NewPropagationContext(cfg)
	ctx.DepManager = dep
	return &Engine{
		config:         cfg,
		ctx:            ctx,
		gen:            NewLoadGenerator(cfg.Pattern, cfg.TargetRPS),
		tickNum:        0,
		originalNodes:  orig,
		deployment:     dep,
		TraceCollector: NewTraceCollector(50),
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

func (e *Engine) StartIncident(scenario *IncidentScenario) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.activeScenario = scenario
	e.stepIndex = 0
	e.trafficMultiplier = 1.0
	e.trafficSpikeEndTick = 0
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
			n.BootTicksRemaining = 0
			n.LastScaleDir = ""
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

func (e *Engine) ExecuteIncidentStep(tickNum int) {
	e.mu.Lock()
	scenario := e.activeScenario
	idx := e.stepIndex
	e.mu.Unlock()

	if scenario == nil || idx >= len(scenario.Steps) {
		return
	}

	step := scenario.Steps[idx]
	if tickNum < step.TriggerTick {
		return
	}

	if idx > 0 {
		prev := scenario.Steps[idx-1]
		if tickNum < prev.TriggerTick {
			return
		}
	}

	switch step.Action {
	case "chaos_inject":
		var p chaosInjectPayload
		if err := json.Unmarshal(step.Payload, &p); err != nil {
			break
		}
		e.injectChaosFromIncident(p)
	case "traffic_spike":
		var p trafficSpikePayload
		if err := json.Unmarshal(step.Payload, &p); err != nil {
			break
		}
		e.mu.Lock()
		e.trafficMultiplier = p.Multiplier
		e.trafficSpikeEndTick = tickNum + p.DurationTicks
		e.mu.Unlock()
	case "config_change":
		var p configChangePayload
		if err := json.Unmarshal(step.Payload, &p); err != nil {
			break
		}
		e.applyConfigChange(p)
	}

	e.mu.Lock()
	e.stepIndex = idx + 1
	e.mu.Unlock()
}

func (e *Engine) injectChaosFromIncident(p chaosInjectPayload) {
	e.mu.RLock()
	cm := e.chaos
	runID := e.RunID
	nodes := e.ctx.Nodes
	tickNum := e.tickNum
	e.mu.RUnlock()

	if cm == nil {
		return
	}

	for _, n := range nodes {
		if n.NodeType == p.TargetNodeType {
			event := &ChaosEvent{
				ID:              runID + "-" + n.ID + "-incident",
				SimulationRunID: runID,
				NodeID:          n.ID,
				EventType:       p.EventType,
				Severity:        p.Severity,
				DurationTicks:   p.DurationTicks,
				StartedAt:       tickNum,
				Active:          true,
			}
			cm.Inject(event)
			cm.ApplyOne(n, event)
		}
	}
}

func (e *Engine) applyConfigChange(p configChangePayload) {
	e.mu.RLock()
	nodes := e.ctx.Nodes
	e.mu.RUnlock()

	for _, n := range nodes {
		if n.NodeType == p.TargetNodeType {
			for key, val := range p.Changes {
				switch key {
				case "latencyMs":
					if v, ok := val.(float64); ok {
						n.LatencyMs = v
					}
				case "errorRate":
					if v, ok := val.(float64); ok {
						n.ErrorRate = v
					}
				case "cacheHitRatio":
					if v, ok := val.(float64); ok {
						n.CacheHitRatio = v
					}
				case "maxRPS":
					if v, ok := val.(float64); ok {
						n.MaxRPS = v
					}
				case "instances":
					if v, ok := val.(float64); ok {
						n.Instances = int(v)
					}
				}
			}
		}
	}
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

// GetNodeMap returns the active node map from the propagation context.
func (e *Engine) GetNodeMap() map[string]*Node {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.ctx.Nodes
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

	e.ExecuteIncidentStep(tickNum)

	e.mu.Lock()
	if e.trafficMultiplier > 1.0 && tickNum < e.trafficSpikeEndTick {
		rps = rps * e.trafficMultiplier
	} else if e.trafficMultiplier > 1.0 {
		e.trafficMultiplier = 1.0
		e.trafficSpikeEndTick = 0
	}
	e.mu.Unlock()

	applySpotInterruptions(ctx.Nodes)

	ctx.PropagateTick(rps, tickNum)

	// Auto-scaling evaluates utilization metrics computed inside PropagateTick
	ApplyAutoScaling(ctx.Nodes, tickNum)

	if cm != nil {
		cm.ApplyPostTick(runID, ctx.Nodes)
	}

	tick := SnapshotTick(tickNum, cfg.Nodes, cfg.Edges, e.deployment)

	e.generateTraces(tick.Timestamp)

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
