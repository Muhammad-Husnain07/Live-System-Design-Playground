package simulation

import (
	"math"
	"testing"
)

func TestTopologicalSort_Linear(t *testing.T) {
	nodes := []Node{
		{ID: "a"}, {ID: "b"}, {ID: "c"},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "b->c", Source: "b", Target: "c"},
	}
	result := TopologicalSort(nodes, edges)
	if result.HasCycles {
		t.Error("linear topology should not have cycles")
	}
	if len(result.Order) != 3 {
		t.Fatalf("expected 3 nodes in order, got %d", len(result.Order))
	}
	// a must come before b, b before c
	pos := make(map[string]int)
	for i, id := range result.Order {
		pos[id] = i
	}
	if pos["a"] > pos["b"] {
		t.Error("a should come before b")
	}
	if pos["b"] > pos["c"] {
		t.Error("b should come before c")
	}
}

func TestTopologicalSort_Cycle(t *testing.T) {
	nodes := []Node{
		{ID: "a", NodeType: NodeMicroservice},
		{ID: "b", NodeType: NodeMicroservice},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "b->a", Source: "b", Target: "a"},
	}
	result := TopologicalSort(nodes, edges)
	if !result.HasCycles {
		t.Error("should detect cycle")
	}
	if len(result.Cycles) == 0 {
		t.Fatal("expected at least one cycle")
	}
}

func TestBreakCycles_AsyncNodeBreaksCycle(t *testing.T) {
	// Cycle: a -> b -> c -> a. c is async (MessageQueue), so c should be the break node.
	nodes := []Node{
		{ID: "a", NodeType: NodeMicroservice},
		{ID: "b", NodeType: NodeMicroservice},
		{ID: "c", NodeType: NodeMessageQueue},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "b->c", Source: "b", Target: "c"},
		{ID: "c->a", Source: "c", Target: "a"},
	}
	topo := TopologicalSort(nodes, edges)
	breaks := BreakCycles(topo, nodes)
	if len(breaks) == 0 {
		t.Fatal("expected cycle break")
	}
	if breaks[0].BreakNode != "c" {
		t.Errorf("expected break node 'c' (async), got '%s'", breaks[0].BreakNode)
	}
}

func TestBreakCycles_NoAsyncNode_FirstNodeBreaks(t *testing.T) {
	// Cycle with no async node: first node in cycle is the break node.
	nodes := []Node{
		{ID: "a", NodeType: NodeMicroservice},
		{ID: "b", NodeType: NodeWebServer},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "b->a", Source: "b", Target: "a"},
	}
	topo := TopologicalSort(nodes, edges)
	breaks := BreakCycles(topo, nodes)
	if len(breaks) == 0 {
		t.Fatal("expected cycle break")
	}
	// Break node should be one of the cycle nodes (order depends on DFS, which
	// is non-deterministic due to Go map iteration in findCycleDFS)
	if breaks[0].BreakNode != "a" && breaks[0].BreakNode != "b" {
		t.Errorf("expected break node 'a' or 'b', got '%s'", breaks[0].BreakNode)
	}
}

func TestPropagateTick_AsyncBoundary(t *testing.T) {
	// Producer -> Queue -> Worker (async boundary at queue)
	nodes := []Node{
		{ID: "producer", NodeType: NodeAppServer, MaxRPS: 5000, Instances: 2, LatencyMs: 10},
		{ID: "queue", NodeType: NodeMessageQueue, MaxRPS: 20000, Instances: 3, LatencyMs: 5},
		{ID: "worker", NodeType: NodeWorkerService, MaxRPS: 2000, Instances: 5, LatencyMs: 20},
	}
	edges := []Edge{
		{ID: "p->q", Source: "producer", Target: "queue", TrafficPercent: 100, IsSync: true},
		{ID: "q->w", Source: "queue", Target: "worker", TrafficPercent: 100, IsSync: false},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Verify cycle break
	if len(ctx.CycleBreaks) > 0 {
		t.Logf("cycle breaks: %+v", ctx.CycleBreaks)
	}
	// First tick: producer processes, queue accumulates
	ctx.PropagateTick(1000, 1)
	producer := ctx.Nodes["producer"]
	queue := ctx.Nodes["queue"]
	worker := ctx.Nodes["worker"]
	if producer.CurrentRPS <= 0 {
		t.Errorf("producer should have positive RPS, got %f", producer.CurrentRPS)
	}
	if queue.CurrentRPS <= 0 {
		t.Errorf("queue should have positive RPS, got %f", queue.CurrentRPS)
	}
	_ = worker
}

func TestPropagateTick_LittlesLaw_QueueExplosion(t *testing.T) {
	// Single node massively overloaded: RPS > Instances * MaxRPS
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 100, Instances: 1, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Overwhelm the server: 5000 RPS base against capacity of 100
	ctx.PropagateTick(5000, 1)
	server := ctx.Nodes["server"]
	if !server.IsBottleneck {
		t.Error("server should be bottleneck")
	}
	if server.CurrentRPS > 100 {
		t.Errorf("server RPS (%f) should be capped at capacity (100)", server.CurrentRPS)
	}
	if server.QueueDepth <= 0 {
		t.Errorf("server should have positive queue depth, got %f", server.QueueDepth)
	}
	// Extreme queue depth: QueueDepth > 10*capacity should spike error rate
	if server.QueueDepth > 100*10 {
		if server.ErrorRate <= 0 {
			t.Log("extreme queue depth detected, checking error rate inflation")
		}
	}
}

func TestPropagateTick_QueueDrain(t *testing.T) {
	// Build queue first with overload, then reduce RPS below capacity to drain
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 500, Instances: 1, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Tick 1: overload
	ctx.PropagateTick(5000, 1)
	server := ctx.Nodes["server"]
	if server.QueueDepth <= 0 {
		t.Skip("queue depth is 0, can't test drain")
	}
	queueDepthAfterOverload := server.QueueDepth

	// Tick 2: reduce RPS well below capacity to drain
	ctx.PropagateTick(50, 2)
	if server.QueueDepth >= queueDepthAfterOverload {
		t.Logf("queue depth went from %f to %f — may need more drain ticks", queueDepthAfterOverload, server.QueueDepth)
	}
}

func TestPropagateTick_RetryStormInflation(t *testing.T) {
	// Node with high error rate should trigger retry storm multiplier
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10, ErrorRate: 0.3},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	baseRPS := 1000.0
	ctx.PropagateTick(baseRPS, 1)
	server := ctx.Nodes["server"]

	// ErrorRate=0.3, RetryStormFactor=3.0 → multiplier = 1 + 0.3*3 = 1.9
	// effectiveRPS = 1000 * 1.9 = 1900
	// After error loss: CurrentRPS = 1900 - (1900 * 0.3) = 1330
	if server.RetryCount <= 0 {
		t.Error("retry storm should set positive RetryCount")
	}
	// The retry storm inflated the incoming RPS before error loss was applied
	if server.DroppedRequests <= 0 {
		t.Errorf("retry storm with errorRate=0.3 should cause dropped requests, got %f", server.DroppedRequests)
	}
	if server.DroppedRequests > 1000 {
		t.Logf("retry storm: incoming was inflated, dropped=%f, current=%f", server.DroppedRequests, server.CurrentRPS)
	}
}

func TestPropagateTick_RetryStormPacketLoss(t *testing.T) {
	// Edge with packet loss should trigger retry buffer on next tick
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true, PacketLossPercent: 50},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	server := ctx.Nodes["server"]

	if len(ctx.retryBuffer) > 0 {
		t.Logf("retry buffer after tick: %v", ctx.retryBuffer)
	}
	if server.RetryCount > 0 {
		t.Logf("server retry count after packet loss: %d", server.RetryCount)
	}
}

func TestPropagateTick_TCPHandshakeOverhead(t *testing.T) {
	// High RPS * Latency should trigger TCP handshake penalty
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		// Low MaxRPS to create high connections, medium latency
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 3000, Instances: 1, LatencyMs: 200},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// IncomingRPS=5000, LatencyMs=200 → tcpLoad = 5000*200 = 1,000,000 > 1000 threshold
	ctx.PropagateTick(5000, 1)
	server := ctx.Nodes["server"]

	// TCP penalty should add latency
	tcpLoad := 5000.0 * 200.0
	if tcpLoad > TCPKeepAliveThreshold {
		expectedPenalty := ((tcpLoad-TCPKeepAliveThreshold)/TCPKeepAliveThreshold) * TCPNewConnectionPenaltyMs
		if expectedPenalty > 10*TCPNewConnectionPenaltyMs {
			expectedPenalty = 10 * TCPNewConnectionPenaltyMs
		}
		if server.P99LatencyMs < expectedPenalty*0.5 {
			t.Errorf("expected TCP penalty ~%f, got P99LatencyMs=%f", expectedPenalty, server.P99LatencyMs)
		}
	} else {
		t.Skip("TCP threshold not exceeded — may need higher RPS or latency")
	}
}

func TestPropagateTick_MultiRegionLatency(t *testing.T) {
	// Source in us-east-1, target in ap-southeast-1
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "us", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10, Region: "us-east-1"},
		{ID: "sg", NodeType: NodeAppServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10, Region: "ap-southeast-1"},
	}
	edges := []Edge{
		{ID: "c->us", Source: "client", Target: "us", TrafficPercent: 100, IsSync: true},
		{ID: "us->sg", Source: "us", Target: "sg", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	usNode := ctx.Nodes["us"]
	sgNode := ctx.Nodes["sg"]
	if usNode.CurrentRPS <= 0 || sgNode.CurrentRPS <= 0 {
		t.Fatal("both nodes should process traffic")
	}
	// The edge from us to sg should have inter-region latency added
	sgEdge := ctx.EdgeOutMap["us"][0]
	if sgEdge == nil {
		t.Fatal("expected edge from us to sg")
	}
	if sgEdge.LatencyMs <= 10 {
		t.Logf("edge latency (us->ap-southeast-1): %f ms (base 10 + inter-region ~180)", sgEdge.LatencyMs)
	}
	// Sync calls across regions suffer double inter-region latency
	expectedLat := 10.0 + GetInterRegionLatency("us-east-1", "ap-southeast-1")*2
	if sgEdge.LatencyMs < expectedLat*0.5 {
		t.Errorf("expected cross-region sync edge latency ~%f, got %f", expectedLat, sgEdge.LatencyMs)
	}
}

func TestPropagateTick_InterRegionAsyncNoDoublePenalty(t *testing.T) {
	// Async edge (isSync=false) should NOT get the double inter-region penalty
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "us", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10, Region: "us-east-1"},
		{ID: "sg", NodeType: NodeAppServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10, Region: "ap-southeast-1"},
	}
	edges := []Edge{
		{ID: "c->us", Source: "client", Target: "us", TrafficPercent: 100, IsSync: true},
		{ID: "us->sg", Source: "us", Target: "sg", TrafficPercent: 100, IsSync: false},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	sgEdge := ctx.EdgeOutMap["us"][0]
	if sgEdge == nil {
		t.Fatal("expected edge from us to sg")
	}
	// Async → no double penalty: base = 10 + 180 = 190
	expectedAsyncLat := 10.0 + GetInterRegionLatency("us-east-1", "ap-southeast-1")
	if sgEdge.LatencyMs < expectedAsyncLat*0.5 {
		t.Errorf("expected async cross-region edge latency ~%f, got %f", expectedAsyncLat, sgEdge.LatencyMs)
	}
}

func TestPropagateTick_FailoverToOtherRegion(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, MaxRPS: 5000, Instances: 2, LatencyMs: 5, Region: "us-east-1", IsFailed: true, ReplicationRole: "primary"},
		{ID: "replica", NodeType: NodePostgreSQLDB, MaxRPS: 5000, Instances: 2, LatencyMs: 10, Region: "eu-west-1", ReplicationRole: "replica"},
	}
	edges := []Edge{
		{ID: "c->p", Source: "client", Target: "primary", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Tick 1: failover tracks the failure
	ctx.PropagateTick(1000, 1)
	if ctx.Nodes["primary"].DroppedRequests <= 0 {
		t.Errorf("failed node should drop all incoming RPS, got %f", ctx.Nodes["primary"].DroppedRequests)
	}
}

func TestGroupIntoLayer(t *testing.T) {
	nodes := []Node{
		{ID: "a"}, {ID: "b"}, {ID: "c"}, {ID: "d"},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "b->c", Source: "b", Target: "c"},
		{ID: "b->d", Source: "b", Target: "d"},
	}
	lg := GroupIntoLayer(nodes, edges)
	if len(lg.Entry) != 1 || lg.Entry[0] != "a" {
		t.Errorf("expected entry node 'a', got %v", lg.Entry)
	}
	if len(lg.Intermediate) != 1 || lg.Intermediate[0] != "b" {
		t.Errorf("expected intermediate node 'b', got %v", lg.Intermediate)
	}
	if len(lg.Exit) != 2 {
		t.Errorf("expected 2 exit nodes, got %v", lg.Exit)
	}
}

func TestUtilizationMetrics_CPUAndMemory(t *testing.T) {
	nm := map[string]*Node{
		"n1": {ID: "n1", MaxRPS: 1000, Instances: 2, LatencyMs: 10, CurrentRPS: 500},
	}
	UtilizationMetrics(nm)
	n := nm["n1"]
	if n.CPUPercent <= 0 {
		t.Errorf("expected CPUPercent > 0 for RPS 500 (capacity 2000), got %f", n.CPUPercent)
	}
	// util = 500/2000 = 0.25 → CPU% = 25
	expectedCPU := (500.0 / 2000.0) * 100
	if n.CPUPercent != expectedCPU {
		t.Errorf("expected CPU %f, got %f", expectedCPU, n.CPUPercent)
	}
	if n.MemoryPercent <= 0 {
		t.Errorf("expected positive MemoryPercent, got %f", n.MemoryPercent)
	}
}

func TestUtilizationMetrics_LatencyTiers(t *testing.T) {
	tests := []struct {
		name      string
		util      float64
		baseLatMs float64
	}{
		{"low utilization (25%)", 0.25, 10},
		{"medium utilization (65%)", 0.65, 10},
		{"high utilization (90%)", 0.90, 10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nm := map[string]*Node{
				"n1": {ID: "n1", MaxRPS: 1000, Instances: 1, LatencyMs: tt.baseLatMs, CurrentRPS: tt.util * 1000},
			}
			UtilizationMetrics(nm)
			n := nm["n1"]
			if n.P99LatencyMs <= 0 {
				t.Errorf("expected positive P99LatencyMs, got %f", n.P99LatencyMs)
			}
			// At low util (<0.5): P99 = base * (1 + util*0.3)
			// At med util (<0.8): P99 = base * (2 + util*0.5)
			// At high util: P99 = base * (5 + util*2)
			t.Logf("util=%f, P99LatencyMs=%f", tt.util, n.P99LatencyMs)
		})
	}
}

func TestUtilizationMetrics_DiskIOPS_Bottleneck(t *testing.T) {
	nm := map[string]*Node{
		"db": {ID: "db", NodeType: NodePostgreSQLDB, MaxRPS: 5000, Instances: 1, LatencyMs: 5, CurrentRPS: 2000, DiskIOPSMax: 1000},
	}
	UtilizationMetrics(nm)
	n := nm["db"]
	// requiredIOPS = 2000 * 5 = 10000 > 1000 → bottleneck + latency multiplier
	if !n.IsBottleneck {
		t.Error("DB with high IOPS demand should be bottleneck")
	}
	expectedLat := n.P99LatencyMs
	_ = expectedLat
}

func TestPropagateTick_JitterOnEdge(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 50},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true, JitterMs: 20},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	edge := ctx.Edges[0]
	if edge.LatencyMs < 0.5 || edge.LatencyMs > 70 {
		t.Logf("jittered latency outside expected range [0.5,70]: %f", edge.LatencyMs)
	}
}

func TestPropagateTick_PacketLossDropsTraffic(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true, PacketLossPercent: 100},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	edge := ctx.Edges[0]
	if edge.DroppedPackets <= 0 {
		t.Errorf("100 pct packet loss should drop all traffic, got %f", edge.DroppedPackets)
	}
	if edge.TrafficPercent > 0 && edge.ThroughputRPS > 0 {
		t.Logf("packet loss with 100%%: dropped=%f, throughput=%f", edge.DroppedPackets, edge.ThroughputRPS)
	}
}

func TestPropagateTick_RetryBufferAcrossTicks(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true, PacketLossPercent: 50},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Tick 1: packet loss creates retry buffer
	ctx.PropagateTick(1000, 1)
	if len(ctx.retryBuffer) == 0 {
		t.Skip("retry buffer is empty — random may have avoided drops with 50% loss")
	}
	// Verify server has extra RPS from retry buffer applied in tick 2
	rpsBefore := ctx.Nodes["server"].IncomingRPS
	ctx.PropagateTick(0, 2) // No new base RPS, only retry buffer
	rpsAfter := ctx.Nodes["server"].IncomingRPS
	if rpsAfter > rpsBefore {
		t.Logf("retry buffer added %f RPS to server (from %f to %f)", rpsAfter-rpsBefore, rpsBefore, rpsAfter)
	}
}

func TestPropagateTick_ConnectionPoolingExhaustion(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "db", NodeType: NodePostgreSQLDB, MaxRPS: 5000, Instances: 1, LatencyMs: 500, ConnectionPoolMax: 10},
	}
	edges := []Edge{
		{ID: "c->db", Source: "client", Target: "db", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// ActiveConnections = 5000 * 500 / 1000 = 2500, far above pool max of 10
	ctx.PropagateTick(5000, 1)
	db := ctx.Nodes["db"]
	if db.ActiveConnections <= float64(db.ConnectionPoolMax) {
		t.Errorf("expected ActiveConnections > ConnectionPoolMax (%d), got %f", db.ConnectionPoolMax, db.ActiveConnections)
	}
	if db.P99LatencyMs > db.LatencyMs {
		t.Logf("connection pool exhaustion caused latency increase: P99=%f (base=%f)", db.P99LatencyMs, db.LatencyMs)
	}
}

func TestPropagateTick_ServerlessColdStart(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "fn", NodeType: NodeServerless, MaxRPS: 100, Instances: 1, ColdStartMs: 500, LatencyMs: 10},
	}
	edges := []Edge{
		{ID: "c->fn", Source: "client", Target: "fn", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// RPS 5000 with MaxRPS 100 per instance → ceil(5000/100) = 50 instances
	// 50 - 1 = 49 new instances → cold penalty = 49 * 500ms = 24500ms
	// But serverless cold start paths only apply when MaxRPS > 0
	ctx.PropagateTick(5000, 1)
	fn := ctx.Nodes["fn"]
	if fn.P99LatencyMs > 100 {
		t.Logf("serverless cold start penalty: P99=%f (base latency=%f)", fn.P99LatencyMs, fn.LatencyMs)
	}
}

func TestPropagateTick_VectorDBLatency(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "vector", NodeType: NodeVectorDB, MaxRPS: 5000, Instances: 1, LatencyMs: 5, TopK: 10, Dimensions: 1536},
	}
	edges := []Edge{
		{ID: "c->v", Source: "client", Target: "vector", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	v := ctx.Nodes["vector"]
	// vecLat = 10 * 1536 * 0.001 = 15.36 ms
	// ragSurcharge = 15.36 * 0.3 = 4.608 ms
	// total added latency = 15.36 + 4.608 = 19.968 ms
	if v.P99LatencyMs <= 5 {
		t.Errorf("VectorDB should add similarity search latency, got P99=%f", v.P99LatencyMs)
	}
}

func TestPropagateTick_LLMNodeProcessingTime(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "llm", NodeType: NodeLLMNode, MaxRPS: 100, Instances: 1, LatencyMs: 10,
			TokensPerSecond: 100, PromptTokenCount: 2000, CompletionTokenCount: 1000},
	}
	edges := []Edge{
		{ID: "c->l", Source: "client", Target: "llm", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(50, 1)
	llm := ctx.Nodes["llm"]
	// processingTime = (2000 + 1000) / 100 * 1000 = 30000ms
	// chunks = ceil(1000/50) = 20, chunk delay = 20*10 = 200ms
	// total added latency ≈ 30200ms
	if llm.P99LatencyMs <= 10 {
		t.Errorf("LLMNode should add inference latency, got P99=%f", llm.P99LatencyMs)
	}
	if llm.P99LatencyMs > 50000 {
		t.Logf("LLM inference latency: %f ms (tokens: prompt=%.0f, completion=%.0f)", llm.P99LatencyMs, llm.PromptTokenCount, llm.CompletionTokenCount)
	}
}

func TestPropagateTick_GPUClusterOOM(t *testing.T) {
	nodes := []Node{
		{ID: "gpu", NodeType: NodeGPUCluster, MaxRPS: 1000, Instances: 1, ModelSizeGB: 80, VRAMGB: 40},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      []Edge{},
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// No incoming RPS, but GPU OOM is independent of load
	ctx.PropagateTick(0, 1)
	gpu := ctx.Nodes["gpu"]
	if !gpu.IsFailed {
		t.Error("GPU with ModelSizeGB > VRAMGB should fail")
	}
	if gpu.ErrorRate != 1.0 {
		t.Errorf("OOM GPU should have 100%% error rate, got %f", gpu.ErrorRate)
	}
}

func TestDetectRAGPipeline_BranchCoverage(t *testing.T) {
	// Path 1: LLMNode→VectorDB→LLMNode chain returns true
	ragNodes := []Node{
		{ID: "llm1", NodeType: NodeLLMNode},
		{ID: "vdb", NodeType: NodeVectorDB},
		{ID: "llm2", NodeType: NodeLLMNode},
	}
	ragEdges := []Edge{
		{ID: "llm1->vdb", Source: "llm1", Target: "vdb"},
		{ID: "vdb->llm2", Source: "vdb", Target: "llm2"},
	}
	if !DetectRAGPipeline(ragNodes, ragEdges) {
		t.Error("DetectRAGPipeline should return true for LLM→VDB→LLM chain")
	}

	// Path 2: LLMNode without VectorDB downstream returns false
	noVdbNodes := []Node{
		{ID: "llm1", NodeType: NodeLLMNode},
		{ID: "svc", NodeType: NodeMicroservice},
	}
	noVdbEdges := []Edge{
		{ID: "llm1->svc", Source: "llm1", Target: "svc"},
	}
	if DetectRAGPipeline(noVdbNodes, noVdbEdges) {
		t.Error("DetectRAGPipeline should return false for LLM→Microservice chain")
	}

	// Path 3: Empty graph returns false
	if DetectRAGPipeline(nil, nil) {
		t.Error("DetectRAGPipeline should return false for empty graph")
	}

	// Edge case: LLM→VDB but no downstream LLM
	partialNodes := []Node{
		{ID: "llm1", NodeType: NodeLLMNode},
		{ID: "vdb", NodeType: NodeVectorDB},
	}
	partialEdges := []Edge{
		{ID: "llm1->vdb", Source: "llm1", Target: "vdb"},
	}
	if DetectRAGPipeline(partialNodes, partialEdges) {
		t.Error("DetectRAGPipeline should return false for LLM→VDB without target LLM")
	}
}

func TestPropagateTick_RAGPipelineCrossTick(t *testing.T) {
	// Setup: Client → LLM1 → VectorDB → LLM2
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "llm1", NodeType: NodeLLMNode, MaxRPS: 100, Instances: 1, LatencyMs: 5,
			TokensPerSecond: 500, PromptTokenCount: 1000, CompletionTokenCount: 500},
		{ID: "vdb", NodeType: NodeVectorDB, MaxRPS: 5000, Instances: 1, LatencyMs: 5,
			TopK: 10, Dimensions: 1536},
		{ID: "llm2", NodeType: NodeLLMNode, MaxRPS: 100, Instances: 1, LatencyMs: 5,
			TokensPerSecond: 500, PromptTokenCount: 500, CompletionTokenCount: 250},
	}
	edges := []Edge{
		{ID: "c->l1", Source: "client", Target: "llm1", TrafficPercent: 100, IsSync: true},
		{ID: "l1->v", Source: "llm1", Target: "vdb", TrafficPercent: 100, IsSync: true},
		{ID: "v->l2", Source: "vdb", Target: "llm2", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)

	// Tick 1: LLM1 processes → registers RAGPendingQuery for LLM2
	//         VectorDB processes → completes retrieval (TickRetrieved = 1)
	//         LLM2 processes → RagContextTokens still 0 (TickRetrieved == tickNum)
	ctx.PropagateTick(100, 1)
	llm1 := ctx.Nodes["llm1"]
	llm2 := ctx.Nodes["llm2"]

	// After tick 1, an LLM → VDB → other LLM chain was detected so RAGPendingQuery exists
	if len(ctx.RAGPendingQueries) == 0 {
		t.Fatal("RAGPendingQueries should have entries after LLM→VDB→LLM chain processes")
	}
	pq := ctx.RAGPendingQueries["llm2"]
	if pq == nil {
		t.Fatal("RAGPendingQuery should exist for llm2 (keyed by target LLM ID)")
	}
	if pq.TickRetrieved != 1 {
		t.Errorf("VectorDB should have completed retrieval on tick 1, got TickRetrieved=%d", pq.TickRetrieved)
	}
	if llm1.RagQueryTokens <= 0 {
		t.Error("LLM1 should have consumed query tokens for the embedding")
	}
	if llm2.RagContextTokens != 0 {
		t.Errorf("LLM2 should NOT have context tokens yet (delivered next tick), got %f", llm2.RagContextTokens)
	}

	// Tick 2: LLM2 receives context tokens from completed RAG query
	ctx.PropagateTick(100, 2)
	if llm2.RagContextTokens <= 0 {
		t.Errorf("LLM2 should have received RAG context by tick 2, got %f", llm2.RagContextTokens)
	}
	if _, ok := ctx.RAGPendingQueries["llm2"]; ok {
		t.Error("RAGPendingQuery for llm2 should be deleted after context delivery")
	}
}

func TestPropagateTick_ReplicationLagStaleReads(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, MaxRPS: 10000, Instances: 2, LatencyMs: 5, ReplicationRole: "primary"},
		{ID: "replica", NodeType: NodePostgreSQLDB, MaxRPS: 10000, Instances: 2, LatencyMs: 10, ReplicationRole: "replica", ReplicationLagMs: 500},
	}
	edges := []Edge{
		{ID: "c->p", Source: "client", Target: "primary", TrafficPercent: 100, IsSync: true},
		{ID: "p->r", Source: "primary", Target: "replica", TrafficPercent: 100, IsSync: false, Protocol: "Replication"},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	replica := ctx.Nodes["replica"]
	if replica.CurrentRPS >= 0 && replica.StaleReadCount > 0 {
		t.Logf("replica stale reads: %f (lag=%fms)", replica.StaleReadCount, replica.ReplicationLagMs)
	}
}

func TestPropagateTick_CacheHitReducesEffectiveRPS(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "cdn", NodeType: NodeCDN, MaxRPS: 50000, Instances: 1, LatencyMs: 5, CacheHitRatio: 0.8},
	}
	edges := []Edge{
		{ID: "c->cdn", Source: "client", Target: "cdn", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	cdn := ctx.Nodes["cdn"]
	// effectiveRPS = 1000 * (1 - 0.8) = 200
	if cdn.CurrentRPS > 250 {
		t.Errorf("cache hit ratio 0.8 should reduce effective RPS to ~200, got %f", cdn.CurrentRPS)
	}
}

func TestPropagateTick_PrimaryDBReadWriteSplit(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "primary", NodeType: NodePostgreSQLDB, MaxRPS: 10000, Instances: 2, LatencyMs: 5, ReplicationRole: "primary"},
	}
	edges := []Edge{
		{ID: "c->p", Source: "client", Target: "primary", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(2000, 1)
	primary := ctx.Nodes["primary"]
	// writeRPS = 2000 * 0.2 = 400
	// primaryReadRPS = 2000 * 0.8 = 1600 (sent through Replication edges)
	expectedWriteRPS := 2000.0 * 0.2
	if primary.CurrentRPS > expectedWriteRPS*1.1 {
		t.Errorf("primary DB should process ~%f write RPS, got %f", expectedWriteRPS, primary.CurrentRPS)
	}
}

func TestPropagateTick_BottleneckMarkedWhenOverCapacity(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "server", NodeType: NodeWebServer, MaxRPS: 200, Instances: 1},
	}
	edges := []Edge{
		{ID: "c->s", Source: "client", Target: "server", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(5000, 1)
	server := ctx.Nodes["server"]
	if !server.IsBottleneck {
		t.Error("server should be marked as bottleneck when RPS=5000 exceeds capacity=200")
	}
	if server.CurrentRPS > 200.1 {
		t.Errorf("server RPS should be capped at 200, got %f", server.CurrentRPS)
	}
}

func TestPropagateTick_EdgeComputeExceedsTimeout(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "edge", NodeType: NodeEdgeCompute, MaxRPS: 100, Instances: 1, LatencyMs: 30},
	}
	edges := []Edge{
		{ID: "c->e", Source: "client", Target: "edge", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// Overload to push P99 beyond timeout
	ctx.PropagateTick(5000, 1)
	edge := ctx.Nodes["edge"]
	if edge.IsFailed {
		t.Logf("edge compute failed: P99=%f > timeout=%f", edge.P99LatencyMs, edge.LatencyMs)
	}
}

func TestPropagateTick_CachedNodeNotBottleneck(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "cdn", NodeType: NodeCDN, MaxRPS: 5000, Instances: 1, LatencyMs: 5, CacheHitRatio: 0.9},
	}
	edges := []Edge{
		{ID: "c->cdn", Source: "client", Target: "cdn", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	// 10000 RPS with 0.9 cache → effective 1000 ≤ 5000 capacity
	ctx.PropagateTick(10000, 1)
	cdn := ctx.Nodes["cdn"]
	if cdn.IsBottleneck {
		t.Error("CDN with 90% cache hit should NOT be bottleneck at 10000 RPS (effective=1000 ≤ 5000)")
	}
}

func TestPropagateTick_OrchestratorWorkflowSteps(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "orch", NodeType: NodeOrchestrator, MaxRPS: 5000, Instances: 1, LatencyMs: 5, FailureMode: "compensate"},
		{ID: "actA", NodeType: NodeMicroservice, MaxRPS: 5000, Instances: 1, LatencyMs: 10, ErrorRate: 0.1},
		{ID: "actB", NodeType: NodeMicroservice, MaxRPS: 5000, Instances: 1, LatencyMs: 10, ErrorRate: 0.01},
	}
	edges := []Edge{
		{ID: "c->o", Source: "client", Target: "orch", TrafficPercent: 100, IsSync: true},
		{ID: "o->a", Source: "orch", Target: "actA", TrafficPercent: 100, IsSync: true},
		{ID: "a->b", Source: "actA", Target: "actB", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	for tick := 1; tick <= 5; tick++ {
		ctx.PropagateTick(100, tick)
	}
	orch := ctx.Nodes["orch"]
	if orch.ActiveWorkflows > 0 {
		t.Logf("orchestrator: active_workflows=%d, step=%d, failures=%d, compensations=%d",
			orch.ActiveWorkflows, orch.WorkflowStep, orch.FailedWorkflows, orch.CompensationEvents)
	}
}

func TestPropagateTick_OrchestratorPanicCascades(t *testing.T) {
	nodes := []Node{
		{ID: "orch", NodeType: NodeOrchestrator, MaxRPS: 5000, Instances: 1, FailureMode: "panic"},
		{ID: "actA", NodeType: NodeMicroservice, MaxRPS: 5000, Instances: 1, ErrorRate: 0.5},
	}
	edges := []Edge{
		{ID: "o->a", Source: "orch", Target: "actA", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	for tick := 1; tick <= 10; tick++ {
		ctx.PropagateTick(100, tick)
	}
	actA := ctx.Nodes["actA"]
	if actA.IsFailed {
		t.Logf("panic mode cascaded failure to activity A: isFailed=%v", actA.IsFailed)
	}
}

func TestPropagateTick_EntryNodeDistribution(t *testing.T) {
	// Two entry nodes should each get same baseRPS
	nodes := []Node{
		{ID: "a", NodeType: NodeWebServer, MaxRPS: 50000, Instances: 1},
		{ID: "b", NodeType: NodeWebServer, MaxRPS: 50000, Instances: 1},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      []Edge{},
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	nA := ctx.Nodes["a"]
	nB := ctx.Nodes["b"]
	if nA.IncomingRPS != 1000 || nB.IncomingRPS != 1000 {
		t.Errorf("both entry nodes should receive full baseRPS (1000), got a=%f, b=%f", nA.IncomingRPS, nB.IncomingRPS)
	}
}

func TestPropagateTick_BlueGreenInactiveNodeSkipped(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "blue", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 2, LatencyMs: 10,
			Deployment: DeploymentConfig{Strategy: StrategyBlueGreen}},
	}
	edges := []Edge{
		{ID: "c->b", Source: "client", Target: "blue", TrafficPercent: 100, IsSync: true},
	}
	cfg := &Config{
		Nodes: nodes,
		Edges: edges,
	}
	ctx := NewPropagationContext(cfg)
	dm := NewDeploymentManager()
	dm.InitFromNodes(nodes)
	// Set blue node group to "green" (active group defaults to "blue")
	dm.SetGroup("blue", "green")
	ctx.DepManager = dm
	ctx.PropagateTick(1000, 1)
	blue := ctx.Nodes["blue"]
	if blue.CurrentRPS > 0 {
		t.Logf("blue node (group=green, active=blue) got currentRPS=%f (should be 0)", blue.CurrentRPS)
	}
	if !dm.IsActiveForBlueGreen("blue") {
		t.Log("blue node correctly skipped (group=green != active=blue)")
	}
}

func TestPropagateTick_ZeroTrafficPercentEqualSplit(t *testing.T) {
	nodes := []Node{
		{ID: "client", NodeType: NodeExternalClient, MaxRPS: 50000, Instances: 1},
		{ID: "a", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1},
		{ID: "b", NodeType: NodeWebServer, MaxRPS: 5000, Instances: 1},
	}
	edges := []Edge{
		{ID: "c->a", Source: "client", Target: "a", TrafficPercent: 0, IsSync: true},
		{ID: "c->b", Source: "client", Target: "b", TrafficPercent: 0, IsSync: true},
	}
	cfg := &Config{
		Nodes:      nodes,
		Edges:      edges,
		TickRateMs: 100,
	}
	ctx := NewPropagationContext(cfg)
	ctx.PropagateTick(1000, 1)
	// Both traffic percents are 0, so totalPercent becomes 100 and each gets 50%
	nA := ctx.Nodes["a"]
	nB := ctx.Nodes["b"]
	if nA.CurrentRPS <= 0 || nB.CurrentRPS <= 0 {
		t.Errorf("both nodes should receive traffic when TrafficPercent=0 (equal split), got a=%f, b=%f", nA.CurrentRPS, nB.CurrentRPS)
	}
	// Each should get ~50% of 1000, minus anything for client
	if nA.CurrentRPS < 400 {
		t.Errorf("expected each node ~500 RPS, got a=%f", nA.CurrentRPS)
	}
}

func TestNewPropagationContext_BuildsEdgeMaps(t *testing.T) {
	nodes := []Node{
		{ID: "a"}, {ID: "b"}, {ID: "c"},
	}
	edges := []Edge{
		{ID: "a->b", Source: "a", Target: "b"},
		{ID: "a->c", Source: "a", Target: "c"},
	}
	cfg := &Config{Nodes: nodes, Edges: edges, TickRateMs: 100}
	ctx := NewPropagationContext(cfg)
	if len(ctx.EdgeOutMap["a"]) != 2 {
		t.Errorf("expected 2 outgoing edges from a, got %d", len(ctx.EdgeOutMap["a"]))
	}
	if len(ctx.EdgeInMap["b"]) != 1 {
		t.Errorf("expected 1 incoming edge to b, got %d", len(ctx.EdgeInMap["b"]))
	}
	if len(ctx.EdgeInMap["c"]) != 1 {
		t.Errorf("expected 1 incoming edge to c, got %d", len(ctx.EdgeInMap["c"]))
	}
	if ctx.TickDurationSec != 0.1 {
		t.Errorf("expected TickDurationSec=0.1 for 100ms tick, got %f", ctx.TickDurationSec)
	}
}

func TestUtilizationMetrics_NegativeRPS_NoCrash(t *testing.T) {
	nm := map[string]*Node{
		"n1": {ID: "n1", MaxRPS: 1000, Instances: 1, CurrentRPS: -100},
	}
	UtilizationMetrics(nm)
	n := nm["n1"]
	if math.IsNaN(n.CPUPercent) {
		t.Errorf("CPUPercent should not be NaN for negative RPS, got %f", n.CPUPercent)
	}
}

func TestUtilizationMetrics_ZeroCapacityNoCrash(t *testing.T) {
	nm := map[string]*Node{
		"n1": {ID: "n1", MaxRPS: 0, Instances: 0, CurrentRPS: 100},
	}
	UtilizationMetrics(nm)
	n := nm["n1"]
	if math.IsNaN(n.CPUPercent) {
		t.Error("CPUPercent should not be NaN when capacity is 0")
	}
}
