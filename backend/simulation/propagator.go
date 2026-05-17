package simulation

import (
	"math"
	"sort"
)

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
	// DeferredOutput accumulates RPS from cycle-break nodes that should arrive
	// at downstream nodes on the NEXT tick (keyed by target node ID).
	DeferredOutput map[string]float64
}

func NewPropagationContext(cfg *Config) *PropagationContext {
	ctx := &PropagationContext{
		Nodes:           make(map[string]*Node, len(cfg.Nodes)),
		Edges:           cfg.Edges,
		EdgeOutMap:      make(map[string][]*Edge),
		EdgeInMap:       make(map[string][]*Edge),
		TickDurationSec: float64(cfg.TickRateMs) / 1000.0,
		DeferredOutput:  make(map[string]float64),
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
	}
	for i := range ctx.Edges {
		ctx.Edges[i].ThroughputRPS = 0
	}

	// Apply deferred outputs from previous tick's cycle-break nodes
	for tgtID, deferred := range ctx.DeferredOutput {
		if n, ok := nodeMap[tgtID]; ok {
			n.IncomingRPS += deferred
		}
	}
	ctx.DeferredOutput = make(map[string]float64)

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
			continue
		}

		incomingRPS := n.IncomingRPS
		for _, e := range ctx.EdgeInMap[id] {
			incomingRPS += e.ThroughputRPS
		}

		if len(ctx.EdgeInMap[id]) > 0 || prevInCycle[id] {
			n.IncomingRPS = incomingRPS
		}

		if IsAsyncNodeType(n.NodeType) {
			n.QueueDepth += n.IncomingRPS * ctx.TickDurationSec
			serveCapacity := float64(n.Instances) * n.MaxRPS * ctx.TickDurationSec
			serveRPS := math.Min(n.QueueDepth, serveCapacity)
			n.CurrentRPS = serveRPS
			n.QueueDepth -= serveRPS
			if n.QueueDepth < 0 {
				n.QueueDepth = 0
			}
		} else {
			capacity := float64(n.Instances) * n.MaxRPS
			if incomingRPS > capacity && capacity > 0 {
				n.IsBottleneck = true
				n.OverflowRPS = incomingRPS - capacity
				n.CurrentRPS = capacity
			} else {
				n.CurrentRPS = incomingRPS
			}
		}

		errorLoss := n.CurrentRPS * n.ErrorRate
		n.CurrentRPS -= errorLoss
		if n.CurrentRPS < 0 {
			n.CurrentRPS = 0
		}
		n.ErrorCount = errorLoss

		if n.Deployment.IsCanaryActive && n.Deployment.CanaryPercent > 0 && n.Deployment.Strategy == StrategyCanary {
			canary := n.CurrentRPS * (n.Deployment.CanaryPercent / 100.0)
			n.CanaryRPS = canary
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
			// Cycle-break node: defer output to next tick instead of setting edge throughput
			for _, e := range outEdges {
				ctx.DeferredOutput[e.Target] += n.CurrentRPS * (e.TrafficPercent / totalPercent)
			}
		} else {
			for _, e := range outEdges {
				e.ThroughputRPS = n.CurrentRPS * (e.TrafficPercent / totalPercent)
				e.LatencyMs = n.LatencyMs
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
