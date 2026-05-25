package simulation

import (
	"math"
	"math/rand"
	"sort"
	"time"
)

const (
	// TCP handshake overhead for new connections beyond keep-alive limits
	TCPNewConnectionPenaltyMs = 50.0
	// Keep-alive connection threshold: if RPS * Latency > this, new connections required
	TCPKeepAliveThreshold = 1000.0
	// Maximum retries per request
	MaxRetriesPerRequest = 3
	// Retry backoff durations in milliseconds
	RetryBackoffMs1 = 100.0
	RetryBackoffMs2 = 200.0
	RetryBackoffMs3 = 400.0
	// Retry storm RPS multiplier formula: originalRPS * (1 + errorRate * RetryStormFactor)
	RetryStormFactor = 3.0
)

func isCacheableNode(nt NodeType) bool {
	switch nt {
	case NodeCDN, NodeRedis, NodeLoadBalancer, NodeAppServer, NodeWebServer, NodeMicroservice:
		return true
	}
	return false
}

func isDatabaseNode(nt NodeType) bool {
	switch nt {
	case NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB, NodeRedis, NodeElasticsearch:
		return true
	}
	return false
}

type Layer int

const (
	LayerEntry       Layer = 0
	LayerIntermediate Layer = 1
	LayerExit        Layer = 2
)

type nodeInEdges struct {
	inDegree  int
	successors []string
	outEdges   []*Edge
}

func buildGraph(nodes []Node, edges []Edge) map[string]*nodeInEdges {
	graph := make(map[string]*nodeInEdges, len(nodes))
	for i := range nodes {
		graph[nodes[i].ID] = &nodeInEdges{inDegree: 0}
	}
	for i := range edges {
		src := edges[i].Source
		tgt := edges[i].Target
		if _, ok := graph[src]; !ok {
			graph[src] = &nodeInEdges{inDegree: 0}
		}
		if _, ok := graph[tgt]; !ok {
			graph[tgt] = &nodeInEdges{inDegree: 0}
		}
		graph[tgt].inDegree++
		graph[src].successors = append(graph[src].successors, tgt)
		graph[src].outEdges = append(graph[src].outEdges, &edges[i])
	}
	return graph
}

type TopoSortResult struct {
	Order   []string
	Cycles  [][]string
	HasCycles bool
}

func TopologicalSort(nodes []Node, edges []Edge) TopoSortResult {
	graph := buildGraph(nodes, edges)

	var order []string
	queue := make([]string, 0)
	for id, info := range graph {
		if info.inDegree == 0 {
			queue = append(queue, id)
		}
	}

	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		order = append(order, id)
		for _, succ := range graph[id].successors {
			graph[succ].inDegree--
			if graph[succ].inDegree == 0 {
				queue = append(queue, succ)
			}
		}
	}

	processed := make(map[string]bool, len(order))
	for _, id := range order {
		processed[id] = true
	}

	result := TopoSortResult{Order: order}

	var unprocessed []string
	for id := range graph {
		if !processed[id] {
			unprocessed = append(unprocessed, id)
		}
	}

	if len(unprocessed) > 0 {
		result.HasCycles = true
		visited := make(map[string]bool)
		inStack := make(map[string]bool)
		for _, id := range unprocessed {
			if !visited[id] {
				cycle := findCycleDFS(id, graph, visited, inStack, make([]string, 0))
				if len(cycle) > 0 {
					result.Cycles = append(result.Cycles, cycle)
				}
			}
		}
	}

	return result
}

func findCycleDFS(start string, graph map[string]*nodeInEdges, visited, inStack map[string]bool, path []string) []string {
	visited[start] = true
	inStack[start] = true
	path = append(path, start)

	for _, succ := range graph[start].successors {
		if !visited[succ] {
			if cycle := findCycleDFS(succ, graph, visited, inStack, path); len(cycle) > 0 {
				return cycle
			}
		} else if inStack[succ] {
			for i, id := range path {
				if id == succ {
					cycle := make([]string, len(path)-i)
					copy(cycle, path[i:])
					return cycle
				}
			}
		}
	}

	inStack[start] = false
	return nil
}

type CycleBreak struct {
	CycleNodes    []string
	BreakNode     string
	BreakNodeType NodeType
}

func BreakCycles(topo TopoSortResult, nodes []Node) []CycleBreak {
	nodeMap := make(map[string]Node, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	var breaks []CycleBreak
	for _, cycle := range topo.Cycles {
		cb := CycleBreak{CycleNodes: cycle}
		breakIdx := -1
		for i, id := range cycle {
			if n, ok := nodeMap[id]; ok && IsAsyncNodeType(n.NodeType) {
				cb.BreakNode = id
				cb.BreakNodeType = n.NodeType
				breakIdx = i
				break
			}
		}
		if breakIdx == -1 {
			cb.BreakNode = cycle[0]
			if n, ok := nodeMap[cycle[0]]; ok {
				cb.BreakNodeType = n.NodeType
			}
		}
		breaks = append(breaks, cb)
	}
	return breaks
}

type LayerGroups struct {
	Entry       []string
	Intermediate []string
	Exit        []string
}

func GroupIntoLayer(nodes []Node, edges []Edge) LayerGroups {
	inDeg := make(map[string]int, len(nodes))
	outDeg := make(map[string]int, len(nodes))
	for _, n := range nodes {
		inDeg[n.ID] = 0
		outDeg[n.ID] = 0
	}
	for _, e := range edges {
		outDeg[e.Source]++
		inDeg[e.Target]++
	}

	var lg LayerGroups
	for _, n := range nodes {
		switch {
		case inDeg[n.ID] == 0:
			lg.Entry = append(lg.Entry, n.ID)
		case outDeg[n.ID] == 0:
			lg.Exit = append(lg.Exit, n.ID)
		default:
			lg.Intermediate = append(lg.Intermediate, n.ID)
		}
	}
	return lg
}

type PropagationContext struct {
	Nodes           map[string]*Node
	Edges           []Edge
	EdgeOutMap      map[string][]*Edge
	EdgeInMap       map[string][]*Edge
	TopoOrder       []string
	CycleBreaks     []CycleBreak
	TickDurationSec float64
	DepManager      *DeploymentManager
	// DeferredOutput accumulates RPS from cycle-break nodes that should arrive
	// at downstream nodes on the NEXT tick (keyed by target node ID).
	DeferredOutput map[string]float64
	// Random source for network simulation (jitter, packet loss)
	rng *rand.Rand
	// Retry buffer: accumulated retry RPS per source node for next tick
	retryBuffer map[string]float64
	// TCP connection tracking per node: activeConnections per tick
	tcpConnections map[string]float64
}

func NewPropagationContext(cfg *Config) *PropagationContext {
	ctx := &PropagationContext{
		Nodes:           make(map[string]*Node, len(cfg.Nodes)),
		Edges:           cfg.Edges,
		EdgeOutMap:      make(map[string][]*Edge),
		EdgeInMap:       make(map[string][]*Edge),
		TickDurationSec: float64(cfg.TickRateMs) / 1000.0,
		DeferredOutput:  make(map[string]float64),
		rng:             rand.New(rand.NewSource(time.Now().UnixNano())),
		retryBuffer:     make(map[string]float64),
		tcpConnections:  make(map[string]float64),
	}
	for i := range cfg.Nodes {
		ctx.Nodes[cfg.Nodes[i].ID] = &cfg.Nodes[i]
	}
	for i := range cfg.Edges {
		e := &cfg.Edges[i]
		ctx.EdgeOutMap[e.Source] = append(ctx.EdgeOutMap[e.Source], e)
		ctx.EdgeInMap[e.Target] = append(ctx.EdgeInMap[e.Target], e)
	}

	topo := TopologicalSort(cfg.Nodes, cfg.Edges)
	ctx.TopoOrder = topo.Order
	ctx.CycleBreaks = BreakCycles(topo, cfg.Nodes)

	return ctx
}

func (ctx *PropagationContext) PropagateTick(baseRPS float64) {
	nodeMap := ctx.Nodes
	cycleBreakSet := make(map[string]bool)
	prevInCycle := make(map[string]bool)
	for _, cb := range ctx.CycleBreaks {
		for _, id := range cb.CycleNodes {
			prevInCycle[id] = true
		}
		cycleBreakSet[cb.BreakNode] = true
	}

	for _, n := range nodeMap {
		n.IncomingRPS = 0
		n.CurrentRPS = 0
		n.CanaryRPS = 0
		n.IsBottleneck = false
		n.OverflowRPS = 0
		n.DroppedRequests = 0
		n.RetryCount = 0
	}
	for i := range ctx.Edges {
		ctx.Edges[i].ThroughputRPS = 0
		ctx.Edges[i].DroppedPackets = 0
	}

	// Apply deferred outputs from previous tick's cycle-break nodes
	for tgtID, deferred := range ctx.DeferredOutput {
		if n, ok := nodeMap[tgtID]; ok {
			n.IncomingRPS += deferred
		}
	}
	ctx.DeferredOutput = make(map[string]float64)

	// ── Retry Storm: apply retry buffer from previous tick ────────────
	for srcID, retryRPS := range ctx.retryBuffer {
		if n, ok := nodeMap[srcID]; ok && retryRPS > 0 {
			n.IncomingRPS += retryRPS
		}
	}
	ctx.retryBuffer = make(map[string]float64)

	entryNodes := make([]string, 0)
	for id, n := range nodeMap {
		ins := ctx.EdgeInMap[id]
		if len(ins) == 0 {
			entryNodes = append(entryNodes, id)
			n.IncomingRPS += baseRPS
		}
	}

	var processOrder []string
	processed := make(map[string]bool)
	queue := make([]string, len(entryNodes))
	copy(queue, entryNodes)
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		if processed[id] {
			continue
		}
		processed[id] = true
		processOrder = append(processOrder, id)
		for _, e := range ctx.EdgeOutMap[id] {
			if !processed[e.Target] {
				queue = append(queue, e.Target)
			}
		}
	}
	for _, id := range ctx.TopoOrder {
		if !processed[id] && !cycleBreakSet[id] {
			processed[id] = true
			processOrder = append(processOrder, id)
		}
	}
	for _, cb := range ctx.CycleBreaks {
		for _, id := range cb.CycleNodes {
			if !processed[id] {
				processOrder = append(processOrder, id)
			}
		}
	}

	for _, id := range processOrder {
		n, ok := nodeMap[id]
		if !ok {
			continue
		}

		if n.IsFailed {
			n.CurrentRPS = 0
			n.IncomingRPS = 0
			n.DroppedRequests = n.IncomingRPS
			continue
		}

		// Blue/green: skip node if its group is not the active set
		if ctx.DepManager != nil && n.Deployment.Strategy == StrategyBlueGreen {
			if !ctx.DepManager.IsActiveForBlueGreen(n.ID) {
				n.CurrentRPS = 0
				n.IncomingRPS = 0
				continue
			}
		}

		incomingRPS := n.IncomingRPS
		for _, e := range ctx.EdgeInMap[id] {
			incomingRPS += e.ThroughputRPS
		}

		if len(ctx.EdgeInMap[id]) > 0 || prevInCycle[id] {
			n.IncomingRPS = incomingRPS
		}

		// ── Caching Logic ────────────────────────────────────────────
		cacheHitRPS := 0.0
		effectiveRPS := incomingRPS
		if isCacheableNode(n.NodeType) && n.CacheHitRatio > 0 {
			ratio := n.CacheHitRatio
			if ratio > 1.0 {
				ratio = 1.0
			}
			cacheHitRPS = effectiveRPS * ratio
			effectiveRPS -= cacheHitRPS
		}

		// ── Retry Storm Logic ──────────────────────────────────────────
		// When error rate is high, clients retry failed requests.
		// RPS_with_retries = originalRPS * (1 + errorRate * RetryStormFactor)
		// This inflates incoming traffic and cascades upstream.
		if n.ErrorRate > 0 {
			retryMultiplier := 1.0 + n.ErrorRate*RetryStormFactor
			if retryMultiplier > 1.0 {
				effectiveRPS = effectiveRPS * retryMultiplier
				n.RetryCount = int(math.Round(n.ErrorRate * float64(MaxRetriesPerRequest)))
				if n.RetryCount < 0 {
					n.RetryCount = 0
				}
			}
		}

		// ── Read/Write Splitting (Primary DBs) ──────────────────────────
		// Primary databases split traffic: 20% writes (processed locally),
		// 80% reads (forwarded to replicas via Replication edges).
		isDBNode := isDatabaseNode(n.NodeType)
		isPrimaryDB := isDBNode && n.ReplicationRole == "primary"
		var primaryReadRPS float64
		if isPrimaryDB {
			writeRPS := effectiveRPS * 0.2
			primaryReadRPS = effectiveRPS * 0.8
			effectiveRPS = writeRPS
		}

		if IsAsyncNodeType(n.NodeType) {
			// ── Async Queue (MessageQueue / EventBus / PubSub) ──────────
			n.QueueDepth += effectiveRPS * ctx.TickDurationSec
			serveCapacity := float64(n.Instances) * n.MaxRPS * ctx.TickDurationSec
			serveRPS := math.Min(n.QueueDepth, serveCapacity)
			n.CurrentRPS = serveRPS
			n.QueueDepth -= serveRPS
			if n.QueueDepth < 0 {
				n.QueueDepth = 0
			}
		} else {
			// ── Killer Queue / Little's Law (M/M/1) ────────────────────
			capacity := float64(n.Instances) * n.MaxRPS

			if effectiveRPS > capacity && capacity > 0 {
				// Queue grows: Incoming RPS exceeds service capacity
				overflow := effectiveRPS - capacity
				n.QueueDepth += overflow * ctx.TickDurationSec
				n.CurrentRPS = capacity
				n.IsBottleneck = true
				n.OverflowRPS = overflow
			} else if n.QueueDepth > 0 {
				// Drain queue: serve queued requests as fast as possible
				drainCapacity := capacity - effectiveRPS
				if drainCapacity > 0 {
					drain := math.Min(n.QueueDepth, drainCapacity*ctx.TickDurationSec)
					n.QueueDepth -= drain
					n.CurrentRPS = effectiveRPS + drain
				} else {
					n.CurrentRPS = effectiveRPS
				}
				if n.QueueDepth < 0 {
					n.QueueDepth = 0
				}
			} else {
				n.CurrentRPS = effectiveRPS
			}

			// Little's Law: Average Queue Time = Queue Depth / Service Rate
			if n.QueueDepth > 0 && capacity > 0 {
				avgQueueTimeMs := (n.QueueDepth / capacity) * 1000.0
				n.P99LatencyMs += math.Min(avgQueueTimeMs, 10000.0)

				// Memory increases steadily with queue depth
				memFromQueue := math.Min(n.QueueDepth/capacity*100, 100)
				n.MemoryPercent = math.Min(n.MemoryPercent+memFromQueue, 100)

				// At extreme queue depths, the node becomes virtually unresponsive
				if n.QueueDepth > capacity*10 {
					n.P99LatencyMs = 10000.0
					n.ErrorRate = math.Min(n.ErrorRate+0.01, 0.5)
				}
			}
		}

		// ── Replication Lag & Stale Reads (Replicas) ────────────────────
		// Replicas serve read traffic but with a lag. A percentage of reads
		// return stale data proportional to ReplicationLagMs.
		isReplica := isDBNode && n.ReplicationRole == "replica"
		if isReplica && n.ReplicationLagMs > 0 && n.CurrentRPS > 0 {
			staleChance := n.ReplicationLagMs / 1000.0
			if staleChance > 1.0 {
				staleChance = 1.0
			}
			staleReads := n.CurrentRPS * staleChance
			n.StaleReadCount = staleReads
			// Stale reads increase latency (serving outdated snapshot requires rollback)
			n.P99LatencyMs += staleChance * 50.0
		}

		// ── Connection Pooling (DBs, AppServers) ─────────────────────
		if n.ConnectionPoolMax > 0 && !IsAsyncNodeType(n.NodeType) {
			n.ActiveConnections = (n.IncomingRPS * n.LatencyMs) / 1000.0
			if n.ActiveConnections > float64(n.ConnectionPoolMax) {
				excess := n.ActiveConnections - float64(n.ConnectionPoolMax)
				penalty := 1.0 + math.Pow(excess, 1.5)
				n.P99LatencyMs = n.LatencyMs * penalty
				n.QueueDepth += excess * ctx.TickDurationSec
				if n.ActiveConnections > float64(n.ConnectionPoolMax)*2 {
					dropRatio := (n.ActiveConnections - float64(n.ConnectionPoolMax)*2) / float64(n.ConnectionPoolMax)
					if dropRatio > 0.5 {
						dropRatio = 0.5
					}
					n.ErrorRate += dropRatio * (1.0 - n.ErrorRate)
				}
			}
		}

		// ── TCP Handshake Overhead ────────────────────────────────────
		// If RPS * Latency > keep-alive threshold, new TCP connections
		// must be established, adding latency penalty.
		tcpLoad := n.IncomingRPS * n.LatencyMs
		if tcpLoad > TCPKeepAliveThreshold && n.CurrentRPS > 0 {
			excessConns := (tcpLoad - TCPKeepAliveThreshold) / TCPKeepAliveThreshold
			if excessConns > 10 {
				excessConns = 10 // cap at 10x multiplier
			}
			tcpPenalty := excessConns * TCPNewConnectionPenaltyMs
			n.P99LatencyMs += tcpPenalty
			n.MemoryPercent = math.Min(n.MemoryPercent+excessConns*2, 100)
		}
		ctx.tcpConnections[n.ID] = n.ActiveConnections

		errorLoss := n.CurrentRPS * n.ErrorRate
		n.DroppedRequests = errorLoss
		n.CurrentRPS -= errorLoss
		if n.CurrentRPS < 0 {
			n.CurrentRPS = 0
		}
		n.ErrorCount = errorLoss

		if ctx.DepManager != nil && n.Deployment.Strategy == StrategyCanary {
			stable, canary, failedOver := ctx.DepManager.ApplyCanarySplit(n.ID, n.CurrentRPS, n.ErrorRate)
			n.CurrentRPS = stable
			n.CanaryRPS = canary
			if failedOver {
				n.Deployment.IsCanaryActive = false
				n.Deployment.CanaryPercent = 0
			}
		}

		// ── Serverless Cold Starts ────────────────────────────────────
		if n.NodeType == NodeServerless && n.ColdStartMs > 0 && n.MaxRPS > 0 {
			maxPerInstance := n.MaxRPS
			if maxPerInstance <= 0 {
				maxPerInstance = 100
			}
			activeInstances := int(math.Ceil(n.CurrentRPS / maxPerInstance))
			if activeInstances < 1 {
				activeInstances = 1
			}
			if activeInstances > n.PrevActiveInstances {
				newInstances := activeInstances - n.PrevActiveInstances
				coldPenalty := float64(newInstances) * n.ColdStartMs
				n.P99LatencyMs += coldPenalty
				n.CPUPercent = math.Min(n.CPUPercent+float64(newInstances)*5, 100)
			}
			n.PrevActiveInstances = activeInstances
		}

		outEdges := ctx.EdgeOutMap[id]
		totalPercent := 0.0
		for _, e := range outEdges {
			totalPercent += e.TrafficPercent
		}
		if totalPercent <= 0 {
			totalPercent = 100.0
			for _, e := range outEdges {
				e.TrafficPercent = 100.0 / float64(len(outEdges))
			}
		}

		if cycleBreakSet[id] {
			for _, e := range outEdges {
				ctx.DeferredOutput[e.Target] += n.CurrentRPS * (e.TrafficPercent / totalPercent)
			}
		} else {
			for _, e := range outEdges {
				// Primary DBs route read traffic through Replication edges
				// and write traffic through regular data-flow edges
				edgeRPS := n.CurrentRPS * (e.TrafficPercent / totalPercent)
				if isPrimaryDB && e.Protocol == "Replication" {
					edgeRPS = primaryReadRPS * (e.TrafficPercent / totalPercent)
				}

				// ── Network Physics on Edge ─────────────────────────
				// Apply jitter: actual latency = baseLatency + uniform(-JitterMs, +JitterMs)
				baseLatency := n.LatencyMs
				actualLatency := baseLatency
				if e.JitterMs > 0 {
					jitter := (ctx.rng.Float64()*2 - 1.0) * e.JitterMs
					actualLatency = baseLatency + jitter
					if actualLatency < 0.5 {
						actualLatency = 0.5
					}
				}
				e.LatencyMs = mathRound(actualLatency, 2)

				// Apply packet loss: random(0,100) < PacketLossPercent → dropped
				if e.PacketLossPercent > 0 && edgeRPS > 0 {
					dropProb := e.PacketLossPercent / 100.0
					droppedRPS := edgeRPS * dropProb
					if droppedRPS > 0 {
						e.DroppedPackets = droppedRPS
						e.ThroughputRPS = edgeRPS - droppedRPS
						n.DroppedRequests += droppedRPS

						// Packet loss triggers retries at the source node
						// Each dropped request retries up to MaxRetriesPerRequest times
						// with exponential backoff, translated into extra RPS next tick
						retryRPS := droppedRPS * float64(MaxRetriesPerRequest)
						ctx.retryBuffer[e.Source] += retryRPS

						// Retries also inflate error count (as failed attempts)
						n.ErrorCount += droppedRPS * float64(MaxRetriesPerRequest)
						n.RetryCount += int(math.Ceil(dropProb * float64(MaxRetriesPerRequest)))
					} else {
						e.ThroughputRPS = edgeRPS
					}
				} else {
					e.ThroughputRPS = edgeRPS
				}
			}
		}
	}

	UtilizationMetrics(nodeMap)
}

func UtilizationMetrics(nodeMap map[string]*Node) {
	for _, n := range nodeMap {
		if n.MaxRPS <= 0 || n.Instances <= 0 {
			continue
		}
		capacity := float64(n.Instances) * n.MaxRPS
		if capacity <= 0 {
			continue
		}

		// CPU/MEM are computed against effective RPS (not cache-hit)
		// which is already what n.CurrentRPS represents after caching logic
		util := n.CurrentRPS / capacity
		n.CPUPercent = math.Min(util*100, 100)
		n.MemoryPercent = math.Min(50+util*50, 100)

		switch {
		case util < 0.5:
			n.P99LatencyMs = n.LatencyMs * (1 + util*0.3)
		case util < 0.8:
			n.P99LatencyMs = n.LatencyMs * (2 + util*0.5)
		default:
			n.P99LatencyMs = n.LatencyMs * (5 + util*2)
		}

		// ── Disk IOPS Bottleneck (Databases) ───────────────────────────
		// RequiredIOPS = CurrentRPS * 5 (assuming 5 disk reads per request).
		// If RequiredIOPS > DiskIOPSMax, multiply latency.
		if isDatabaseNode(n.NodeType) && n.DiskIOPSMax > 0 && n.CurrentRPS > 0 {
			requiredIOPS := n.CurrentRPS * 5
			if requiredIOPS > n.DiskIOPSMax {
				latencyMultiplier := requiredIOPS / n.DiskIOPSMax
				n.P99LatencyMs = n.P99LatencyMs * latencyMultiplier
				n.IsBottleneck = true
			}
		}
	}
}

type sortedNode struct {
	id   string
	layer Layer
}

func SortedLayerOrder(nodes []Node, edges []Edge) []string {
	layers := GroupIntoLayer(nodes, edges)
	lookup := make(map[string]Layer, len(nodes))
	for _, id := range layers.Entry {
		lookup[id] = LayerEntry
	}
	for _, id := range layers.Intermediate {
		lookup[id] = LayerIntermediate
	}
	for _, id := range layers.Exit {
		lookup[id] = LayerExit
	}

	sorted := make([]sortedNode, len(nodes))
	for i, n := range nodes {
		sorted[i] = sortedNode{id: n.ID, layer: lookup[n.ID]}
	}
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].layer < sorted[j].layer })

	result := make([]string, len(sorted))
	for i, sn := range sorted {
		result[i] = sn.id
	}
	return result
}
