package simulation

import (
	"testing"
)

func TestChaosNodeFailure(t *testing.T) {
	cm := NewChaosManager()
	nodes := []Node{
		{ID: "server", NodeType: NodeWebServer, Label: "Server", MaxRPS: 5000, Instances: 3},
	}
	nodeMap := make(map[string]*Node)
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	cm.Inject(&ChaosEvent{
		ID:            "ev-1",
		SimulationRunID: "run-1",
		NodeID:        "server",
		EventType:     ChaosNodeFailure,
		Severity:      1.0,
		DurationTicks: 10,
		StartedAt:     1,
		Active:        true,
	})

	cm.ApplyPreTick("run-1", nodeMap, 1)

	if !nodeMap["server"].IsFailed {
		t.Error("server should be marked as failed after NodeFailure injection")
	}

	cm.ApplyPreTick("run-1", nodeMap, 2)
	if !nodeMap["server"].IsFailed {
		t.Error("server should remain failed during active event")
	}
}

func TestChaosDDoS(t *testing.T) {
	cm := NewChaosManager()
	nodes := []Node{
		{ID: "lb", NodeType: NodeLoadBalancer, Label: "LB", MaxRPS: 10000, Instances: 2},
	}
	nodeMap := make(map[string]*Node)
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	origMaxRPS := nodeMap["lb"].MaxRPS

	cm.Inject(&ChaosEvent{
		ID:              "ev-ddos",
		SimulationRunID: "run-1",
		NodeID:          "lb",
		EventType:       ChaosDDoS,
		Severity:        0.8,
		DurationTicks:   5,
		StartedAt:       1,
		Active:          true,
	})

	cm.ApplyPreTick("run-1", nodeMap, 1)

	if nodeMap["lb"].MaxRPS >= origMaxRPS {
		t.Errorf("DDoS should reduce MaxRPS (was %f, now %f)", origMaxRPS, nodeMap["lb"].MaxRPS)
	}
	if nodeMap["lb"].ErrorRate <= 0 {
		t.Error("DDoS should increase error rate")
	}
	if nodeMap["lb"].Instances < 1 {
		t.Error("instances should remain at least 1 after DDoS")
	}
}

func TestChaosExpiration(t *testing.T) {
	cm := NewChaosManager()
	nodes := []Node{
		{ID: "server", NodeType: NodeWebServer, Label: "Server", MaxRPS: 5000, Instances: 3},
	}
	nodeMap := make(map[string]*Node)
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	cm.Inject(&ChaosEvent{
		ID:              "ev-exp",
		SimulationRunID: "run-1",
		NodeID:          "server",
		EventType:       ChaosNodeFailure,
		Severity:        1.0,
		DurationTicks:   2,
		StartedAt:       1,
		Active:          true,
	})

	cm.ApplyPreTick("run-1", nodeMap, 1)
	if !nodeMap["server"].IsFailed {
		t.Error("server should be failed during active event")
	}

	engine := NewEngine(&Config{
		Nodes: nodes,
		Edges: []Edge{},
	})
	engine.SetChaosManager(cm)

	cm.ApplyPreTick("run-1", nodeMap, 3)
	engine.RunTick()

	active := cm.ActiveEvents("run-1")
	if len(active) != 0 {
		t.Errorf("expected 0 active events after expiration, got %d", len(active))
		for _, ev := range active {
			t.Logf("  still active: %s (startedAt=%d, duration=%d, tick=3)", ev.ID, ev.StartedAt, ev.DurationTicks)
		}
	}
}
