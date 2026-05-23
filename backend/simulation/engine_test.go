package simulation

import (
	"testing"
)

func TestEngineLinearTopology(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "lb", NodeType: NodeLoadBalancer, Label: "LB", MaxRPS: 50000, Instances: 2},
		{ID: "server", NodeType: NodeWebServer, Label: "Server", MaxRPS: 4000, Instances: 3},
		{ID: "db", NodeType: NodePostgreSQLDB, Label: "DB", MaxRPS: 10000, Instances: 2},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "lb", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "lb", Target: "server", IsSync: true, TrafficPercent: 100},
		{ID: "e3", Source: "server", Target: "db", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID:       "proj-1",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       1000,
		DurationSeconds: 10,
		SpeedMultiplier: 10,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	ticks := engine.Ticks()
	if len(ticks) != 1 {
		t.Fatalf("expected 1 tick, got %d", len(ticks))
	}
	tick := ticks[0]
	if tick.TotalRPS <= 0 {
		t.Errorf("expected positive TotalRPS, got %f", tick.TotalRPS)
	}
	if len(tick.NodeMetrics) != 4 {
		t.Errorf("expected metrics for 4 nodes, got %d", len(tick.NodeMetrics))
	}
	nodeMap := make(map[string]NodeMetricsSnapshot)
	for _, m := range tick.NodeMetrics {
		nodeMap[m.NodeID] = m
	}
	for _, id := range []string{"client", "lb", "server", "db"} {
		if _, ok := nodeMap[id]; !ok {
			t.Errorf("missing metrics for node %s", id)
		}
	}
	if nodeMap["server"].CurrentRPS > nodeMap["lb"].CurrentRPS {
		t.Errorf("server RPS (%f) should not exceed LB RPS (%f)", nodeMap["server"].CurrentRPS, nodeMap["lb"].CurrentRPS)
	}
}

func TestEngineCyclicTopology(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "a", NodeType: NodeMicroservice, Label: "Service A", MaxRPS: 5000, Instances: 2},
		{ID: "b", NodeType: NodeMicroservice, Label: "Service B", MaxRPS: 5000, Instances: 2},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "a", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "a", Target: "b", IsSync: true, TrafficPercent: 100},
		{ID: "e3", Source: "b", Target: "a", IsSync: true, TrafficPercent: 50},
	}
	cfg := &Config{
		ProjectID:       "proj-2",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       1000,
		DurationSeconds: 10,
		SpeedMultiplier: 10,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	ticks := engine.Ticks()
	if len(ticks) != 1 {
		t.Fatalf("expected 1 tick, got %d", len(ticks))
	}
	tick := ticks[0]
	if tick.TotalRPS <= 0 {
		t.Errorf("expected positive TotalRPS, got %f", tick.TotalRPS)
	}
	nodeMap := make(map[string]NodeMetricsSnapshot)
	for _, m := range tick.NodeMetrics {
		nodeMap[m.NodeID] = m
	}
	for _, id := range []string{"a", "b"} {
		m, ok := nodeMap[id]
		if !ok {
			t.Errorf("missing metrics for node %s", id)
			continue
		}
		if m.CurrentRPS < 0 {
			t.Errorf("node %s has negative RPS (%f)", id, m.CurrentRPS)
		}
	}
}

func TestEngineAsyncBoundary(t *testing.T) {
	nodes := []Node{
		{ID: "producer", NodeType: NodeAppServer, Label: "Producer", MaxRPS: 5000, Instances: 2},
		{ID: "queue", NodeType: NodeMessageQueue, Label: "Queue", MaxRPS: 20000, Instances: 3},
		{ID: "worker", NodeType: NodeWorkerService, Label: "Worker", MaxRPS: 2000, Instances: 5},
	}
	edges := []Edge{
		{ID: "e1", Source: "producer", Target: "queue", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "queue", Target: "worker", IsSync: false, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID:       "proj-3",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       500,
		DurationSeconds: 10,
		SpeedMultiplier: 10,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	engine := NewEngine(cfg)
	for i := 0; i < 3; i++ {
		engine.RunTick()
	}
	ticks := engine.Ticks()
	if len(ticks) != 3 {
		t.Fatalf("expected 3 ticks, got %d", len(ticks))
	}
	lastTick := ticks[len(ticks)-1]
	nodeMap := make(map[string]NodeMetricsSnapshot)
	for _, m := range lastTick.NodeMetrics {
		nodeMap[m.NodeID] = m
	}
	queue, ok := nodeMap["queue"]
	if !ok {
		t.Fatal("missing queue metrics")
	}
	if !queue.IsAsync {
		t.Error("queue node should be marked as async")
	}
	worker, ok := nodeMap["worker"]
	if !ok {
		t.Fatal("missing worker metrics")
	}
	if queue.QueueDepth < 0 {
		t.Errorf("queue depth should be >= 0, got %f", queue.QueueDepth)
	}
	_ = worker
}

func TestEngineBottleneckDetection(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, Label: "Server", MaxRPS: 100, Instances: 1},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "server", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID:       "proj-4",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       5000,
		DurationSeconds: 5,
		SpeedMultiplier: 1,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	engine := NewEngine(cfg)
	for i := 0; i < 5; i++ {
		engine.RunTick()
	}
	ticks := engine.Ticks()
	if len(ticks) == 0 {
		t.Fatal("expected at least one tick")
	}
	lastTick := ticks[len(ticks)-1]
	serverFound := false
	for _, m := range lastTick.NodeMetrics {
		if m.NodeID == "server" {
			serverFound = true
			if !m.IsBottleneck {
				t.Error("server should be marked as bottleneck when RPS exceeds capacity")
			}
			if m.CurrentRPS > 100 {
				t.Errorf("server RPS (%f) should not exceed max capacity (100)", m.CurrentRPS)
			}
		}
	}
	if !serverFound {
		t.Error("missing server metrics")
	}
	if lastTick.GlobalErrorRate < 0 {
		t.Error("global error rate should be >= 0")
	}
}

func TestEngineCanaryDeployment(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, Label: "Server", MaxRPS: 5000, Instances: 3,
			Deployment: DeploymentConfig{Strategy: StrategyCanary, CanaryPercent: 20, IsCanaryActive: true, CanaryVersion: "v2"}},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "server", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID:       "proj-5",
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       1000,
		DurationSeconds: 5,
		SpeedMultiplier: 1,
		Pattern:         TrafficSteady,
		TickRateMs:      100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]
	serverMetrics := tick.NodeMetrics[0]
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "server" {
			serverMetrics = m
			break
		}
	}
	if serverMetrics.CanaryRPS <= 0 {
		t.Errorf("expected canary to receive some traffic, got canary RPS = %f", serverMetrics.CanaryRPS)
	}
	if serverMetrics.CurrentRPS <= 0 {
		t.Errorf("expected positive total RPS for canary node, got %f", serverMetrics.CurrentRPS)
	}
}
