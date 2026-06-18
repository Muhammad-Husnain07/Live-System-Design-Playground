package simulation

import (
	"testing"
)

func TestIsValidChaosType(t *testing.T) {
	valid := []ChaosEventType{
		ChaosNodeFailure, ChaosLatencySpike, ChaosErrorRateSpike,
		ChaosNetworkPartition, ChaosDDoS, ChaosRegionDown,
		ChaosMemoryLeak, ChaosCPUSaturation, ChaosSplitBrain,
	}
	for _, ct := range valid {
		if !IsValidChaosType(ct) {
			t.Errorf("expected %q to be valid", ct)
		}
	}
	if IsValidChaosType("InvalidType") {
		t.Error("expected InvalidType to be invalid")
	}
}

func TestChaosInjectAndActive(t *testing.T) {
	cm := NewChaosManager()
	ev := &ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "node-1",
		EventType: ChaosNodeFailure, Severity: 1.0, DurationTicks: 10,
		StartedAt: 5, Active: true,
	}
	cm.Inject(ev)
	active := cm.ActiveEvents("run-1")
	if len(active) != 1 {
		t.Fatalf("expected 1 active event, got %d", len(active))
	}
	if active[0].ID != "ev-1" {
		t.Errorf("expected ev-1, got %s", active[0].ID)
	}
}

func TestChaosActiveEvents_EmptyRun(t *testing.T) {
	cm := NewChaosManager()
	active := cm.ActiveEvents("nonexistent")
	if active != nil {
		t.Errorf("expected nil for nonexistent run, got %v", active)
	}
}

func TestChaosRemoveEvent(t *testing.T) {
	cm := NewChaosManager()
	cm.Inject(&ChaosEvent{ID: "ev-1", SimulationRunID: "run-1", Active: true})
	cm.RemoveEvent("run-1", "ev-1")
	active := cm.ActiveEvents("run-1")
	if len(active) != 0 {
		t.Errorf("expected 0 active events after removal, got %d", len(active))
	}
}

func TestChaosClearRun(t *testing.T) {
	cm := NewChaosManager()
	cm.Inject(&ChaosEvent{ID: "ev-1", SimulationRunID: "run-1", Active: true})
	cm.Inject(&ChaosEvent{ID: "ev-2", SimulationRunID: "run-1", Active: true})
	cm.ClearRun("run-1")
	active := cm.ActiveEvents("run-1")
	if active != nil {
		t.Errorf("expected nil after clear, got %v", active)
	}
}

func TestApplyOne_NodeFailure(t *testing.T) {
	n := &Node{ID: "n1", IsFailed: false}
	ev := &ChaosEvent{EventType: ChaosNodeFailure}
	cm := NewChaosManager()
	cm.ApplyOne(n, ev)
	if !n.IsFailed {
		t.Error("expected node to be failed")
	}
}

func TestApplyOne_LatencySpike(t *testing.T) {
	n := &Node{ID: "n1", LatencyMs: 50}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosLatencySpike, Severity: 0.5})
	expected := 50.0 * (1.0 + 0.5*9.0)
	if n.LatencyMs != expected {
		t.Errorf("expected latency %f, got %f", expected, n.LatencyMs)
	}
}

func TestApplyOne_LatencySpike_JitterBomb(t *testing.T) {
	n := &Node{ID: "n1", LatencyMs: 50}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosLatencySpike, Severity: 0.8})
	multiplier := 1.0 + 0.8*9.0
	jitter := 0.8 * 500.0 * 0.5
	expected := 50.0*multiplier + jitter
	if n.LatencyMs != expected {
		t.Errorf("expected latency %f, got %f", expected, n.LatencyMs)
	}
}

func TestApplyOne_ErrorRateSpike(t *testing.T) {
	n := &Node{ID: "n1", ErrorRate: 0.01}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosErrorRateSpike, Severity: 0.3})
	if n.ErrorRate != 0.3 {
		t.Errorf("expected error rate 0.3, got %f", n.ErrorRate)
	}
}

func TestApplyOne_ErrorRateSpike_DoesNotLower(t *testing.T) {
	n := &Node{ID: "n1", ErrorRate: 0.5}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosErrorRateSpike, Severity: 0.3})
	if n.ErrorRate != 0.5 {
		t.Errorf("expected error rate to stay 0.5, got %f", n.ErrorRate)
	}
}

func TestApplyOne_NetworkPartition_Total(t *testing.T) {
	n := &Node{ID: "n1", Instances: 3, MaxRPS: 5000}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosNetworkPartition, Severity: 1.0})
	if n.Instances != 0 || n.MaxRPS != 0 {
		t.Errorf("expected instances=0, maxRPS=0; got instances=%d, maxRPS=%f", n.Instances, n.MaxRPS)
	}
}

func TestApplyOne_NetworkPartition_Degraded(t *testing.T) {
	n := &Node{ID: "n1", Instances: 4, MaxRPS: 5000}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosNetworkPartition, Severity: 0.5})
	if n.Instances < 1 {
		t.Errorf("expected at least 1 instance, got %d", n.Instances)
	}
	if n.MaxRPS != 5000 {
		t.Errorf("maxRPS should remain unchanged, got %f", n.MaxRPS)
	}
}

func TestApplyOne_DDoS(t *testing.T) {
	n := &Node{ID: "n1", MaxRPS: 5000, Instances: 10}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosDDoS, Severity: 0.5})
	expectedMaxRPS := 5000.0 * (1.0 - 0.5*0.9)
	if n.MaxRPS != expectedMaxRPS {
		t.Errorf("expected maxRPS %f, got %f", expectedMaxRPS, n.MaxRPS)
	}
	if n.Instances >= 10 {
		t.Errorf("expected instances < 10 after DDoS, got %d", n.Instances)
	}
	if n.ErrorRate < 0.15 {
		t.Errorf("expected error rate >= 0.15, got %f", n.ErrorRate)
	}
}

func TestApplyOne_RegionDown(t *testing.T) {
	n := &Node{ID: "n1"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosRegionDown})
	if !n.IsFailed || n.MaxRPS != 0 || n.Instances != 0 {
		t.Error("expected node failed, maxRPS=0, instances=0")
	}
}

func TestApplyOne_CPUSaturation(t *testing.T) {
	n := &Node{ID: "n1", MaxRPS: 5000}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosCPUSaturation, Severity: 0.5})
	expectedMaxRPS := 5000.0 * (1.0 - 0.5*0.95)
	if n.MaxRPS != expectedMaxRPS {
		t.Errorf("expected maxRPS %f, got %f", expectedMaxRPS, n.MaxRPS)
	}
	if n.CPUPercent != 95.0 {
		t.Errorf("expected CPU 95%%, got %f", n.CPUPercent)
	}
}

func TestApplyOne_MemoryLeak(t *testing.T) {
	n := &Node{ID: "n1", ErrorRate: 0.01, LatencyMs: 100}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosMemoryLeak, Severity: 0.5})
	if n.ErrorRate <= 0.01 {
		t.Errorf("expected error rate to increase, got %f", n.ErrorRate)
	}
	expectedLatency := 100.0 * (1.0 + 0.5*0.1)
	if n.LatencyMs != expectedLatency {
		t.Errorf("expected latency %f, got %f", expectedLatency, n.LatencyMs)
	}
}

func TestApplyOne_SplitBrain_Primary(t *testing.T) {
	n := &Node{ID: "n1", NodeType: NodePostgreSQLDB, ReplicationRole: "primary"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if !n.IsSplitBrain {
		t.Error("expected IsSplitBrain true")
	}
	if n.DataInconsistency != 500.0 {
		t.Errorf("expected dataInconsistency 500, got %f", n.DataInconsistency)
	}
	if n.ErrorRate < 0.3 {
		t.Errorf("expected error rate >= 0.3, got %f", n.ErrorRate)
	}
}

func TestApplyOne_SplitBrain_Replica(t *testing.T) {
	n := &Node{ID: "n1", NodeType: NodePostgreSQLDB, ReplicationRole: "replica"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if n.ReplicationRole != "primary" {
		t.Errorf("expected replica to promote to primary, got %s", n.ReplicationRole)
	}
	if !n.IsSplitBrain {
		t.Error("expected IsSplitBrain true")
	}
}

func TestApplyOne_SplitBrain_NonDatabase(t *testing.T) {
	n := &Node{ID: "n1", NodeType: NodeWebServer}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if n.IsSplitBrain {
		t.Error("non-database node should not be split brain")
	}
}

func TestApplyPreTick_ExpiredEvent(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1", IsFailed: false}
	nodeMap := map[string]*Node{"n1": n}
	ev := &ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "n1",
		EventType: ChaosNodeFailure, Severity: 1.0,
		DurationTicks: 5, StartedAt: 0, Active: true,
	}
	cm.Inject(ev)
	cm.ApplyPreTick("run-1", nodeMap, 10)
	if ev.Active {
		t.Error("expected event to be deactivated after duration expired")
	}
	if n.IsFailed {
		t.Error("expected node to not be failed after event expired")
	}
}

func TestApplyPreTick_ActiveEvent(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1", IsFailed: false}
	nodeMap := map[string]*Node{"n1": n}
	ev := &ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "n1",
		EventType: ChaosNodeFailure, Severity: 1.0,
		DurationTicks: 10, StartedAt: 5, Active: true,
	}
	cm.Inject(ev)
	cm.ApplyPreTick("run-1", nodeMap, 8)
	if !n.IsFailed {
		t.Error("expected node to be failed while event is active")
	}
}

func TestApplyPreTick_EventWithoutDuration(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1", IsFailed: false}
	nodeMap := map[string]*Node{"n1": n}
	ev := &ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "n1",
		EventType: ChaosNodeFailure, Severity: 1.0,
		DurationTicks: 0, StartedAt: 5, Active: true,
	}
	cm.Inject(ev)
	cm.ApplyPreTick("run-1", nodeMap, 100)
	if !n.IsFailed {
		t.Error("expected node to remain failed for events with no duration")
	}
}

func TestApplyPostTick_MemoryLeak(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1", MemoryPercent: 30, CPUPercent: 40, NodeType: NodeWebServer}
	nodeMap := map[string]*Node{"n1": n}
	ev := &ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "n1",
		EventType: ChaosMemoryLeak, Severity: 0.5, Active: true,
	}
	cm.Inject(ev)
	cm.ApplyPostTick("run-1", nodeMap)
	if n.MemoryPercent <= 30 {
		t.Errorf("expected memory to increase, got %f", n.MemoryPercent)
	}
	if n.CPUPercent <= 40 {
		t.Errorf("expected CPU to increase, got %f", n.CPUPercent)
	}
}

func TestApplyPostTick_NonMemoryLeak(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1", MemoryPercent: 30, CPUPercent: 40}
	nodeMap := map[string]*Node{"n1": n}
	cm.Inject(&ChaosEvent{
		ID: "ev-1", SimulationRunID: "run-1", NodeID: "n1",
		EventType: ChaosNodeFailure, Active: true,
	})
	cm.ApplyPostTick("run-1", nodeMap)
	if n.MemoryPercent != 30 || n.CPUPercent != 40 {
		t.Error("non-memory-leak events should not affect PostTick")
	}
}

func TestApplyPreTick_NoEventsForRun(t *testing.T) {
	cm := NewChaosManager()
	n := &Node{ID: "n1"}
	nodeMap := map[string]*Node{"n1": n}
	cm.ApplyPreTick("nonexistent", nodeMap, 1)
}

func TestActiveEvents_FiltersInactive(t *testing.T) {
	cm := NewChaosManager()
	cm.Inject(&ChaosEvent{ID: "ev-1", SimulationRunID: "run-1", Active: true})
	cm.Inject(&ChaosEvent{ID: "ev-2", SimulationRunID: "run-1", Active: false})
	active := cm.ActiveEvents("run-1")
	if len(active) != 1 {
		t.Errorf("expected 1 active event, got %d", len(active))
	}
	if active[0].ID != "ev-1" {
		t.Errorf("expected ev-1, got %s", active[0].ID)
	}
}

func TestDDoS_MinMaxRPS(t *testing.T) {
	n := &Node{ID: "n1", MaxRPS: 1, Instances: 1}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosDDoS, Severity: 1.0})
	if n.MaxRPS < 1 {
		t.Errorf("maxRPS should be at least 1, got %f", n.MaxRPS)
	}
	if n.Instances < 1 {
		t.Errorf("instances should be at least 1, got %d", n.Instances)
	}
}
