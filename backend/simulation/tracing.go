package simulation

import (
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

type SpanStatus string

const (
	SpanStatusOK    SpanStatus = "OK"
	SpanStatusERROR SpanStatus = "ERROR"
)

type SpanType string

const (
	SpanTypeDefault SpanType = ""
	SpanTypeCache   SpanType = "CACHE_HIT"
	SpanTypeAsync   SpanType = "ASYNC_WAIT"
)

type Span struct {
	SpanID     string    `json:"spanId"`
	TraceID    string    `json:"traceId"`
	NodeID     string    `json:"nodeId"`
	NodeLabel  string    `json:"nodeLabel"`
	NodeType   string    `json:"nodeType"`
	EntryTime  time.Time `json:"entryTime"`
	ExitTime   time.Time `json:"exitTime"`
	DurationMs float64   `json:"durationMs"`
	Status     SpanStatus `json:"status"`
	SpanType   SpanType  `json:"spanType,omitempty"`
}

type Trace struct {
	TraceID         string    `json:"traceId"`
	Spans           []Span    `json:"spans"`
	RootNodeID      string    `json:"rootNodeId"`
	RootNodeLabel   string    `json:"rootNodeLabel"`
	StartTime       time.Time `json:"startTime"`
	EndTime         time.Time `json:"endTime"`
	TotalDurationMs float64   `json:"totalDurationMs"`
	Status          SpanStatus `json:"status"`
	HasError        bool      `json:"hasError"`
}

func NewTraceFromNodes(traceID string, nodeIDs []string, nodeMap map[string]*Node, tickTime time.Time, edges []Edge, edgeOutMap map[string][]*Edge) Trace {
	now := tickTime
	spans := make([]Span, 0, len(nodeIDs))
	totalDuration := 0.0
	hasError := false
	rootLabel := ""

	for i, id := range nodeIDs {
		n, ok := nodeMap[id]
		if !ok {
			continue
		}
		if i == 0 {
			rootLabel = n.Label
		}

		latency := n.P99LatencyMs
		if latency <= 0 {
			latency = n.LatencyMs
		}
		if latency <= 0 {
			latency = 10
		}

		entry := now.Add(time.Duration(totalDuration) * time.Millisecond)
		exit := entry.Add(time.Duration(latency) * time.Millisecond)
		totalDuration += latency

		status := SpanStatusOK
		if n.ErrorRate > 0.05 || n.IsFailed {
			status = SpanStatusERROR
			hasError = true
		}

		spanType := SpanTypeDefault
		if isCacheableNode(n.NodeType) && n.CacheHitRatio > 0 && rand.Float64() < n.CacheHitRatio {
			spanType = SpanTypeCache
		}
		if IsAsyncNodeType(n.NodeType) {
			spanType = SpanTypeAsync
		}

		spans = append(spans, Span{
			SpanID:     uuid.New().String(),
			TraceID:    traceID,
			NodeID:     n.ID,
			NodeLabel:  n.Label,
			NodeType:   string(n.NodeType),
			EntryTime:  entry,
			ExitTime:   exit,
			DurationMs: latency,
			Status:     status,
			SpanType:   spanType,
		})
	}

	traceStatus := SpanStatusOK
	if hasError {
		traceStatus = SpanStatusERROR
	}

	return Trace{
		TraceID:         traceID,
		Spans:           spans,
		RootNodeID:      nodeIDs[0],
		RootNodeLabel:   rootLabel,
		StartTime:       now,
		EndTime:         now.Add(time.Duration(totalDuration) * time.Millisecond),
		TotalDurationMs: totalDuration,
		Status:          traceStatus,
		HasError:        hasError,
	}
}

type TraceCollector struct {
	mu     sync.RWMutex
	traces []Trace
	max    int
}

func NewTraceCollector(max int) *TraceCollector {
	return &TraceCollector{
		traces: make([]Trace, 0, max),
		max:    max,
	}
}

func (tc *TraceCollector) Add(t Trace) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.traces = append(tc.traces, t)
	if len(tc.traces) > tc.max {
		tc.traces = tc.traces[len(tc.traces)-tc.max:]
	}
}

func (tc *TraceCollector) Recent() []Trace {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	result := make([]Trace, len(tc.traces))
	copy(result, tc.traces)
	return result
}

func (tc *TraceCollector) Len() int {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	return len(tc.traces)
}

func (e *Engine) generateTraces(tickTime time.Time) {
	e.mu.RLock()
	ctx := e.ctx
	e.mu.RUnlock()

	if ctx == nil {
		return
	}

	nodeMap := ctx.Nodes
	entryNodes := make([]string, 0)
	for id, n := range nodeMap {
		if len(ctx.EdgeInMap[id]) == 0 && n.CurrentRPS > 0 {
			entryNodes = append(entryNodes, id)
		}
	}
	if len(entryNodes) == 0 {
		return
	}

	totalRPS := 0.0
	for _, n := range nodeMap {
		totalRPS += n.CurrentRPS
	}

	requestCount := totalRPS * ctx.TickDurationSec
	traceCount := int(requestCount / 100)
	if traceCount < 1 && requestCount > 0 {
		if rand.Float64() < requestCount/100 {
			traceCount = 1
		}
	}
	if traceCount > 5 {
		traceCount = 5
	}

	for ti := 0; ti < traceCount; ti++ {
		if len(entryNodes) == 0 {
			return
		}

		rootID := entryNodes[rand.Intn(len(entryNodes))]
		visited := make(map[string]bool)
		path := make([]string, 0)

		var dfs func(id string)
		dfs = func(id string) {
			if visited[id] {
				return
			}
			visited[id] = true
			path = append(path, id)
			for _, e := range ctx.EdgeOutMap[id] {
				if n, ok := nodeMap[e.Target]; ok && n.CurrentRPS > 0 {
					dfs(e.Target)
				}
			}
		}
		dfs(rootID)

		if len(path) < 1 {
			continue
		}

		traceID := uuid.New().String()
		trace := NewTraceFromNodes(traceID, path, nodeMap, tickTime, ctx.Edges, ctx.EdgeOutMap)

		e.mu.RLock()
		collector := e.TraceCollector
		e.mu.RUnlock()
		if collector != nil {
			collector.Add(trace)
		}
	}
}
