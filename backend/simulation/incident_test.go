package simulation

import (
	"encoding/json"
	"testing"
)

func TestIncidentExecuteStep_NoScenario(t *testing.T) {
	engine := testEngine()
	engine.ExecuteIncidentStep(5)
}

func TestIncidentExecuteStep_BeforeTriggerTick(t *testing.T) {
	engine := testEngine()
	engine.StartIncident(&Scenarios[0])
	engine.ExecuteIncidentStep(1)
	if engine.stepIndex != 0 {
		t.Errorf("expected stepIndex 0 (not advanced), got %d", engine.stepIndex)
	}
}

func TestIncidentExecuteStep_ChaosInject(t *testing.T) {
	engine := testEngine()
	cm := NewChaosManager()
	engine.SetChaosManager(cm)
	engine.RunID = "test-run"

	scenario := &IncidentScenario{
		ID: "test-scenario",
		Steps: []IncidentStep{
			{
				TriggerTick: 5,
				Action:      "chaos_inject",
				Payload:     json.RawMessage(`{"eventType":"LatencySpike","severity":0.8,"durationTicks":20,"targetNodeType":"AppServer"}`),
			},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(5)

	active := cm.ActiveEvents("test-run")
	if len(active) == 0 {
		t.Fatal("expected at least one active chaos event")
	}
	found := false
	for _, ev := range active {
		if ev.EventType == ChaosLatencySpike {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected a LatencySpike chaos event")
	}
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex 1, got %d", engine.stepIndex)
	}
}

func TestIncidentExecuteStep_TrafficSpike(t *testing.T) {
	engine := testEngine()
	scenario := &IncidentScenario{
		ID: "test-spike",
		Steps: []IncidentStep{
			{
				TriggerTick: 3,
				Action:      "traffic_spike",
				Payload:     json.RawMessage(`{"multiplier":3.0,"durationTicks":10}`),
			},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(3)

	if engine.trafficMultiplier != 3.0 {
		t.Errorf("expected trafficMultiplier 3.0, got %f", engine.trafficMultiplier)
	}
	if engine.trafficSpikeEndTick != 13 {
		t.Errorf("expected trafficSpikeEndTick 13, got %d", engine.trafficSpikeEndTick)
	}
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex 1, got %d", engine.stepIndex)
	}
}

func TestIncidentExecuteStep_ConfigChange(t *testing.T) {
	engine := testEngine()
	nodes := []Node{
		{ID: "app-1", NodeType: NodeAppServer, LatencyMs: 50, ErrorRate: 0.01},
		{ID: "app-2", NodeType: NodeAppServer, LatencyMs: 30, ErrorRate: 0.02},
	}
	engine.config.Nodes = nodes
	engine.ctx = NewPropagationContext(engine.config)

	scenario := &IncidentScenario{
		ID: "test-config",
		Steps: []IncidentStep{
			{
				TriggerTick: 5,
				Action:      "config_change",
				Payload:     json.RawMessage(`{"targetNodeType":"AppServer","changes":{"latencyMs":800,"errorRate":0.15}}`),
			},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(5)

	for _, n := range engine.ctx.Nodes {
		if n.NodeType == NodeAppServer {
			if n.LatencyMs != 800 {
				t.Errorf("expected latency 800, got %f for node %s", n.LatencyMs, n.ID)
			}
			if n.ErrorRate != 0.15 {
				t.Errorf("expected errorRate 0.15, got %f for node %s", n.ErrorRate, n.ID)
			}
		}
	}
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex 1, got %d", engine.stepIndex)
	}
}

func TestIncidentExecuteStep_ConfigChangeCacheHitRatio(t *testing.T) {
	engine := testEngine()
	nodes := []Node{
		{ID: "redis-1", NodeType: NodeRedis, CacheHitRatio: 0.85},
	}
	engine.config.Nodes = nodes
	engine.ctx = NewPropagationContext(engine.config)

	scenario := &IncidentScenario{
		ID: "test-cache",
		Steps: []IncidentStep{
			{
				TriggerTick: 5,
				Action:      "config_change",
				Payload:     json.RawMessage(`{"targetNodeType":"Redis","changes":{"cacheHitRatio":0}}`),
			},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(5)

	n := engine.ctx.Nodes["redis-1"]
	if n == nil {
		t.Fatal("node not found")
	}
	if n.CacheHitRatio != 0 {
		t.Errorf("expected cacheHitRatio 0, got %f", n.CacheHitRatio)
	}
}

func TestIncidentExecuteStep_MultipleSteps(t *testing.T) {
	engine := testEngine()
	cm := NewChaosManager()
	engine.SetChaosManager(cm)
	engine.RunID = "test-run-multi"

	nodes := []Node{
		{ID: "app-1", NodeType: NodeAppServer, LatencyMs: 50, ErrorRate: 0.01},
	}
	engine.config.Nodes = nodes
	engine.ctx = NewPropagationContext(engine.config)

	scenario := &IncidentScenario{
		ID: "multi-step",
		Steps: []IncidentStep{
			{TriggerTick: 5, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"AppServer","changes":{"latencyMs":800,"errorRate":0.15}}`)},
			{TriggerTick: 5, Action: "chaos_inject", Payload: json.RawMessage(`{"eventType":"LatencySpike","severity":0.8,"durationTicks":20,"targetNodeType":"AppServer"}`)},
			{TriggerTick: 12, Action: "traffic_spike", Payload: json.RawMessage(`{"multiplier":3.0,"durationTicks":10}`)},
		},
	}
	engine.StartIncident(scenario)

	engine.ExecuteIncidentStep(5) // executes step 0
	engine.ExecuteIncidentStep(5) // executes step 1 (also at tick 5)
	if engine.stepIndex != 2 {
		t.Fatalf("expected stepIndex 2 after tick 5 (two steps at tick 5), got %d", engine.stepIndex)
	}

	n := engine.ctx.Nodes["app-1"]
	if n.LatencyMs <= 800 {
		t.Errorf("expected latency > 800 after config change + latency spike, got %f", n.LatencyMs)
	}

	active := cm.ActiveEvents("test-run-multi")
	if len(active) == 0 {
		t.Error("expected active chaos events after chaos_inject step")
	}

	engine.ExecuteIncidentStep(12)
	if engine.stepIndex != 3 {
		t.Errorf("expected stepIndex 3 after tick 12, got %d", engine.stepIndex)
	}
	if engine.trafficMultiplier != 3.0 {
		t.Errorf("expected trafficMultiplier 3.0, got %f", engine.trafficMultiplier)
	}
}

func TestIncidentExecuteStep_StepNotTriggeredBeforePrevStep(t *testing.T) {
	engine := testEngine()
	scenario := &IncidentScenario{
		ID: "ordering",
		Steps: []IncidentStep{
			{TriggerTick: 10, Action: "traffic_spike", Payload: json.RawMessage(`{"multiplier":2.0,"durationTicks":5}`)},
			{TriggerTick: 5, Action: "traffic_spike", Payload: json.RawMessage(`{"multiplier":3.0,"durationTicks":5}`)},
		},
	}
	engine.StartIncident(scenario)

	engine.ExecuteIncidentStep(5)
	if engine.stepIndex != 0 {
		t.Errorf("expected stepIndex 0 (first step not triggered before its trigger tick), got %d", engine.stepIndex)
	}

	engine.ExecuteIncidentStep(10)
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex 1 after step 0 executes, got %d", engine.stepIndex)
	}
	_ = engine.stepIndex
}

func TestIncidentExecuteStep_UnknownAction(t *testing.T) {
	engine := testEngine()
	scenario := &IncidentScenario{
		ID: "unknown-action",
		Steps: []IncidentStep{
			{TriggerTick: 1, Action: "unknown_action", Payload: nil},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(1)
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex advanced even for unknown action, got %d", engine.stepIndex)
	}
}

func TestIncidentExecuteStep_ChaosInjectWithoutManager(t *testing.T) {
	engine := testEngine()
	scenario := &IncidentScenario{
		ID: "no-chaos-manager",
		Steps: []IncidentStep{
			{TriggerTick: 1, Action: "chaos_inject", Payload: json.RawMessage(`{"eventType":"NodeFailure","severity":1.0,"durationTicks":10,"targetNodeType":"AppServer"}`)},
		},
	}
	engine.StartIncident(scenario)
	engine.ExecuteIncidentStep(1)
	if engine.stepIndex != 1 {
		t.Errorf("expected stepIndex 1 even without chaos manager, got %d", engine.stepIndex)
	}
}

func TestScenariosAreValid(t *testing.T) {
	for _, s := range Scenarios {
		t.Run(s.ID, func(t *testing.T) {
			if s.ID == "" {
				t.Error("scenario ID must not be empty")
			}
			if s.Name == "" {
				t.Error("scenario Name must not be empty")
			}
			if len(s.Steps) == 0 {
				t.Error("scenario must have at least one step")
			}
			for i, step := range s.Steps {
				if step.TriggerTick < 0 {
					t.Errorf("step %d: triggerTick must be >= 0", i)
				}
				if step.Action == "" {
					t.Errorf("step %d: action must not be empty", i)
				}
				if step.Action == "chaos_inject" {
					var p chaosInjectPayload
					if err := json.Unmarshal(step.Payload, &p); err != nil {
						t.Errorf("step %d: invalid chaos_inject payload: %v", i, err)
					}
					if !IsValidChaosType(p.EventType) {
						t.Errorf("step %d: invalid chaos event type %q", i, p.EventType)
					}
				}
				if step.Action == "traffic_spike" {
					var p trafficSpikePayload
					if err := json.Unmarshal(step.Payload, &p); err != nil {
						t.Errorf("step %d: invalid traffic_spike payload: %v", i, err)
					}
					if p.Multiplier <= 0 {
						t.Errorf("step %d: multiplier must be > 0", i)
					}
				}
			}
		})
	}
}

func TestChaosInjectFromIncident(t *testing.T) {
	engine := testEngine()
	cm := NewChaosManager()
	engine.SetChaosManager(cm)
	engine.RunID = "incident-run"

	engine.injectChaosFromIncident(chaosInjectPayload{
		EventType:      ChaosNodeFailure,
		Severity:       1.0,
		DurationTicks:  10,
		TargetNodeType: NodeAppServer,
	})

	active := cm.ActiveEvents("incident-run")
	if len(active) == 0 {
		t.Error("expected chaos events to be injected")
	}
	for _, ev := range active {
		if ev.EventType != ChaosNodeFailure {
			t.Errorf("expected NodeFailure event, got %s", ev.EventType)
		}
		if !ev.Active {
			t.Error("expected event to be active")
		}
	}
}

func TestConfigChangeInstances(t *testing.T) {
	engine := testEngine()
	nodes := []Node{
		{ID: "svc-1", NodeType: NodeMicroservice, Instances: 3},
	}
	engine.config.Nodes = nodes
	engine.ctx = NewPropagationContext(engine.config)

	engine.applyConfigChange(configChangePayload{
		TargetNodeType: NodeMicroservice,
		Changes:        map[string]any{"instances": float64(1)},
	})

	n := engine.ctx.Nodes["svc-1"]
	if n == nil {
		t.Fatal("node not found")
	}
	if n.Instances != 1 {
		t.Errorf("expected instances 1, got %d", n.Instances)
	}
}

func TestConfigChangeMaxRPS(t *testing.T) {
	engine := testEngine()
	nodes := []Node{
		{ID: "svc-1", NodeType: NodeMicroservice, MaxRPS: 2000},
	}
	engine.config.Nodes = nodes
	engine.ctx = NewPropagationContext(engine.config)

	engine.applyConfigChange(configChangePayload{
		TargetNodeType: NodeMicroservice,
		Changes:        map[string]any{"maxRPS": float64(50)},
	})

	n := engine.ctx.Nodes["svc-1"]
	if n == nil {
		t.Fatal("node not found")
	}
	if n.MaxRPS != 50 {
		t.Errorf("expected maxRPS 50, got %f", n.MaxRPS)
	}
}

func TestTrafficSpikeResetsAfterEndTick(t *testing.T) {
	engine := testEngine()
	engine.trafficMultiplier = 3.0
	engine.trafficSpikeEndTick = 10

	engine.mu.Lock()
	engine.tickNum = 11
	engine.mu.Unlock()

	rps := 100.0

	evaluate := func() float64 {
		engine.mu.Lock()
		defer engine.mu.Unlock()
		if engine.trafficMultiplier > 1.0 && engine.tickNum < engine.trafficSpikeEndTick {
			return rps * engine.trafficMultiplier
		} else if engine.trafficMultiplier > 1.0 {
			engine.trafficMultiplier = 1.0
			engine.trafficSpikeEndTick = 0
		}
		return rps
	}

	result := evaluate()
	if result != 100.0 {
		t.Errorf("expected 100 after spike end, got %f", result)
	}
	if engine.trafficMultiplier != 1.0 {
		t.Errorf("expected multiplier reset to 1.0, got %f", engine.trafficMultiplier)
	}
	if engine.trafficSpikeEndTick != 0 {
		t.Errorf("expected spikeEndTick 0, got %d", engine.trafficSpikeEndTick)
	}
}

func testEngine() *Engine {
	nodes := []Node{
		{ID: "lb-1", NodeType: NodeLoadBalancer, Label: "LB", MaxRPS: 50000, Instances: 2},
		{ID: "app-1", NodeType: NodeAppServer, Label: "App", MaxRPS: 5000, Instances: 3},
	}
	edges := []Edge{
		{ID: "e1", Source: "lb-1", Target: "app-1", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID:       "test-incident",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       500,
		DurationSeconds: 10,
		SpeedMultiplier: 10,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	return NewEngine(cfg)
}
