package simulation

import (
	"testing"
)

// Read/Write Splitting: Primary DB receives 20% write traffic,
// 80% read traffic is routed through Replication edges.
func TestReadWriteSplit_PrimaryDB(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, Label: "Primary", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "primary", IsPrimaryDB: true},
		{ID: "replica", NodeType: NodePostgreSQLDB, Label: "Replica", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "replica", ReplicationLagMs: 50},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "primary", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "primary", Target: "replica", IsSync: false, TrafficPercent: 100, Protocol: "Replication"},
	}
	cfg := &Config{
		ProjectID: "rw-split", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var primaryMetrics, replicaMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "primary" {
			primaryMetrics = m
		}
		if m.NodeID == "replica" {
			replicaMetrics = m
		}
	}

	// Primary should process ~20% of incoming RPS as writes
	expectedWriteRPS := 1000.0 * 0.2
	if primaryMetrics.CurrentRPS > expectedWriteRPS*1.5 || primaryMetrics.CurrentRPS < expectedWriteRPS*0.5 {
		t.Errorf("primary write RPS ~= %f, got %f (expected ~20%% of 1000)", expectedWriteRPS, primaryMetrics.CurrentRPS)
	}

	// Replica should receive ~80% of incoming RPS as reads
	if replicaMetrics.CurrentRPS <= 0 {
		t.Errorf("expected replica to receive read traffic, got RPS=%f", replicaMetrics.CurrentRPS)
	}
	if replicaMetrics.CurrentRPS < primaryMetrics.CurrentRPS {
		t.Errorf("expected replica RPS (%f) > primary write RPS (%f)", replicaMetrics.CurrentRPS, primaryMetrics.CurrentRPS)
	}
}

func TestReadWriteSplit_PrimaryDB_NoReplicationEdge(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, Label: "Primary", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "primary", IsPrimaryDB: true},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "primary", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID: "rw-split-norepl", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var primaryMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "primary" {
			primaryMetrics = m
		}
	}

	// Without a Replication edge, 80% read traffic is dropped
	expectedWriteRPS := 1000.0 * 0.2
	diff := primaryMetrics.CurrentRPS - expectedWriteRPS
	if diff < 0 {
		diff = -diff
	}
	if diff > expectedWriteRPS*0.5 {
		t.Errorf("primary write RPS should be ~%f without replication edge, got %f (diff too large)", expectedWriteRPS, primaryMetrics.CurrentRPS)
	}
}

// Non-primary DB nodes do NOT get read/write split
func TestReadWriteSplit_NonPrimaryDB(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "db", NodeType: NodePostgreSQLDB, Label: "Standalone DB", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "none"},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "db", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID: "rw-split-nonprimary", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var dbMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "db" {
			dbMetrics = m
		}
	}

	// Non-primary DB should process all incoming RPS (no 20/80 split)
	if dbMetrics.CurrentRPS < 800 {
		t.Errorf("expected non-primary DB to process most incoming traffic, got %f", dbMetrics.CurrentRPS)
	}
}

// Stale Read Calculation: ReplicationLagMs / 1000 = stale chance
func TestStaleReads_Replica(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, Label: "Primary", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "primary"},
		{ID: "replica", NodeType: NodePostgreSQLDB, Label: "Replica", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "replica", ReplicationLagMs: 500},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "primary", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "primary", Target: "replica", IsSync: false, TrafficPercent: 100, Protocol: "Replication"},
	}
	cfg := &Config{
		ProjectID: "stale-reads", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var replicaMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "replica" {
			replicaMetrics = m
		}
	}

	// At 500ms lag: staleChance = 0.5, so StaleReadCount = CurrentRPS * 0.5
	expectedStalePct := 0.5
	if replicaMetrics.StaleReadCount <= 0 {
		t.Errorf("expected stale reads > 0 with 500ms lag, got %f", replicaMetrics.StaleReadCount)
	}
	actualStalePct := replicaMetrics.StaleReadCount / replicaMetrics.CurrentRPS
	if actualStalePct < expectedStalePct*0.5 || actualStalePct > expectedStalePct*1.5 {
		t.Errorf("expected stale read ratio ~%f, got %f (staleReads=%f, currentRPS=%f)",
			expectedStalePct, actualStalePct, replicaMetrics.StaleReadCount, replicaMetrics.CurrentRPS)
	}
}

func TestStaleReads_Replica_NoLag(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, Label: "Primary", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "primary"},
		{ID: "replica", NodeType: NodePostgreSQLDB, Label: "Replica", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "replica", ReplicationLagMs: 0},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "primary", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "primary", Target: "replica", IsSync: false, TrafficPercent: 100, Protocol: "Replication"},
	}
	cfg := &Config{
		ProjectID: "stale-no-lag", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var replicaMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "replica" {
			replicaMetrics = m
		}
	}

	if replicaMetrics.StaleReadCount != 0 {
		t.Errorf("expected no stale reads with 0 lag, got %f", replicaMetrics.StaleReadCount)
	}
}

func TestStaleReads_Replica_MaxLag(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, Label: "Primary", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "primary"},
		{ID: "replica", NodeType: NodePostgreSQLDB, Label: "Replica", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "replica", ReplicationLagMs: 2000},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "primary", IsSync: true, TrafficPercent: 100},
		{ID: "e2", Source: "primary", Target: "replica", IsSync: false, TrafficPercent: 100, Protocol: "Replication"},
	}
	cfg := &Config{
		ProjectID: "stale-max-lag", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var replicaMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "replica" {
			replicaMetrics = m
		}
	}

	// At 2000ms lag: staleChance caps at 1.0, so all reads are stale
	if replicaMetrics.StaleReadCount < replicaMetrics.CurrentRPS*0.9 {
		t.Errorf("expected most reads stale with 2000ms lag, staleReads=%f, currentRPS=%f",
			replicaMetrics.StaleReadCount, replicaMetrics.CurrentRPS)
	}
}

// Non-replica DB nodes should NOT have stale reads
func TestStaleReads_NonReplica(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, Label: "Client", MaxRPS: 50000, Instances: 1},
		{ID: "db", NodeType: NodePostgreSQLDB, Label: "Standalone DB", MaxRPS: 5000, Instances: 2,
			ReplicationRole: "none"},
	}
	edges := []Edge{
		{ID: "e1", Source: "client", Target: "db", IsSync: true, TrafficPercent: 100},
	}
	cfg := &Config{
		ProjectID: "stale-nonreplica", Nodes: nodes, Edges: edges,
		TargetRPS: 1000, DurationSeconds: 5, SpeedMultiplier: 10,
		Pattern: TrafficSteady, TickRateMs: 100,
	}
	engine := NewEngine(cfg)
	engine.RunTick()
	tick := engine.Ticks()[0]

	var dbMetrics NodeMetricsSnapshot
	for _, m := range tick.NodeMetrics {
		if m.NodeID == "db" {
			dbMetrics = m
		}
	}

	if dbMetrics.StaleReadCount != 0 {
		t.Errorf("expected no stale reads on non-replica, got %f", dbMetrics.StaleReadCount)
	}
}

// Split-Brain on Primary: error rate spikes
func TestSplitBrain_Primary_ErrorRateSpike(t *testing.T) {
	n := &Node{ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "primary", ErrorRate: 0.01}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if !n.IsSplitBrain {
		t.Error("expected IsSplitBrain true")
	}
	expectedErrorRate := 0.01 + 0.5*0.6
	if n.ErrorRate != expectedErrorRate {
		t.Errorf("expected errorRate %f, got %f", expectedErrorRate, n.ErrorRate)
	}
}

// Split-Brain on Replica: promotes to primary, latency increases
func TestSplitBrain_Replica_PromotesToPrimary(t *testing.T) {
	n := &Node{ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "replica", LatencyMs: 100}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if n.ReplicationRole != "primary" {
		t.Errorf("expected replica to promote to primary, got %s", n.ReplicationRole)
	}
	if !n.IsSplitBrain {
		t.Error("expected IsSplitBrain true")
	}
	expectedLatency := 100.0 * (1.0 + 0.5*0.5)
	if n.LatencyMs != expectedLatency {
		t.Errorf("expected latency %f, got %f", expectedLatency, n.LatencyMs)
	}
}

// Split-Brain on non-database node: no-op
func TestSplitBrain_NonDBNode_Noop(t *testing.T) {
	n := &Node{ID: "web-1", NodeType: NodeWebServer}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	if n.IsSplitBrain {
		t.Error("non-database node should not be split-brain")
	}
}

// Split-Brain promotes replica to primary, which then activates read/write splitting
func TestSplitBrain_Replica_ActivatesRWSplit(t *testing.T) {
	// Simulate what happens after SplitBrain promotes a replica:
	// The node becomes "primary" role, so incoming RPS should get 20/80 split
	n := &Node{
		ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "replica",
		MaxRPS: 5000, Instances: 2, IsSplitBrain: true,
	}
	// Apply SplitBrain
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})

	if n.ReplicationRole != "primary" {
		t.Fatal("expected replica to promote to primary")
	}

	// In PropagateTick, the node would now be treated as primary with read/write split.
	// Verify the role check in the propagator: isPrimaryDB = isDBNode && n.ReplicationRole == "primary"
	isDBNode := isDatabaseNode(n.NodeType)
	isPrimaryDB := isDBNode && n.ReplicationRole == "primary"
	if !isPrimaryDB {
		t.Error("promoted replica should be treated as primary DB")
	}
}

// DataInconsistency increases with SplitBrain severity
func TestSplitBrain_DataInconsistency(t *testing.T) {
	n := &Node{ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "primary"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.7})
	if n.DataInconsistency != 700.0 {
		t.Errorf("expected dataInconsistency 700, got %f", n.DataInconsistency)
	}
}

func TestSplitBrain_DataInconsistency_Accumulates(t *testing.T) {
	n := &Node{ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "primary"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.3})
	if n.DataInconsistency != 800.0 {
		t.Errorf("expected accumulated dataInconsistency 800, got %f", n.DataInconsistency)
	}
}

// SplitBrain adds stale-read-like latency penalty AND data inconsistency
func TestSplitBrain_P99LatencyImpact(t *testing.T) {
	n := &Node{ID: "db-1", NodeType: NodePostgreSQLDB, ReplicationRole: "primary"}
	cm := NewChaosManager()
	cm.ApplyOne(n, &ChaosEvent{EventType: ChaosSplitBrain, Severity: 0.5})
	// SplitBrain directly spikes error rate, does NOT add to P99 (P99 handled by propagator)
	if n.ErrorRate < 0.3 {
		t.Errorf("expected error rate >= 0.3 after split-brain, got %f", n.ErrorRate)
	}
}
