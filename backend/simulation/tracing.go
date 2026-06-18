package simulation

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

type SpanEvent struct {
	Timestamp time.Time         `json:"timestamp"`
	Name      string            `json:"name"`
	Attributes map[string]any   `json:"attributes,omitempty"`
}

type SpanLink struct {
	TraceID    string            `json:"traceId"`
	SpanID     string            `json:"spanId"`
	Attributes map[string]any    `json:"attributes,omitempty"`
}

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
	SpanID        string            `json:"spanId"`
	TraceID       string            `json:"traceId"`
	ParentSpanID  string            `json:"parentSpanId,omitempty"`
	NodeID        string            `json:"nodeId"`
	NodeLabel     string            `json:"nodeLabel"`
	NodeType      string            `json:"nodeType"`
	EntryTime     time.Time         `json:"entryTime"`
	ExitTime      time.Time         `json:"exitTime"`
	DurationMs    float64           `json:"durationMs"`
	Status        SpanStatus        `json:"status"`
	SpanType      SpanType          `json:"spanType,omitempty"`
	// OTel semantic convention fields
	ServiceName       string            `json:"service.name,omitempty"`
	TelemetrySDKName  string            `json:"telemetry.sdk.name,omitempty"`
	NetSockPeerAddr   string            `json:"net.sock.peer.addr,omitempty"`
	Attributes        map[string]any    `json:"attributes,omitempty"`
	Events            []SpanEvent       `json:"events,omitempty"`
	Links             []SpanLink        `json:"links,omitempty"`
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

type LogLevel string

const (
	LogLevelInfo     LogLevel = "INFO"
	LogLevelWarn     LogLevel = "WARN"
	LogLevelError    LogLevel = "ERROR"
	LogLevelCritical LogLevel = "CRITICAL"
)

type SimLog struct {
	Timestamp  time.Time `json:"timestamp"`
	TraceID    string    `json:"traceId"`
	SpanID     string    `json:"spanId"`
	Service    string    `json:"service"`
	Level      LogLevel  `json:"level"`
	Message    string    `json:"message"`
	DurationMs float64   `json:"durationMs"`
	NodeID     string    `json:"nodeId"`
}

func NewTraceFromNodes(traceID string, nodeIDs []string, nodeMap map[string]*Node, tickTime time.Time, edges []Edge, edgeOutMap map[string][]*Edge, logs *[]SimLog) Trace {
	now := tickTime
	spans := make([]Span, 0, len(nodeIDs))
	totalDuration := 0.0
	hasError := false
	rootLabel := ""
	var parentSpanID string

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
		isAsync := IsAsyncNodeType(n.NodeType)
		if isAsync {
			spanType = SpanTypeAsync
		}

		spanID := uuid.New().String()

		// OTel attributes
		attrs := map[string]any{
			"node.id":   n.ID,
			"node.type": string(n.NodeType),
		}
		if n.CurrentRPS > 0 {
			attrs["rps"] = n.CurrentRPS
		}
		if n.ErrorRate > 0 {
			attrs["error.rate"] = n.ErrorRate
		}
		if n.CacheHitRatio > 0 {
			attrs["cache.hit_ratio"] = n.CacheHitRatio
		}
		if n.RetryCount > 0 {
			attrs["retry.count"] = n.RetryCount
		}
		if n.IsFailed {
			attrs["failed"] = true
		}
		if n.Region != "" {
			attrs["cloud.region"] = n.Region
		}

		// Span events for error conditions
		var events []SpanEvent
		if status == SpanStatusERROR {
			reason := "error_rate_exceeded"
			if n.IsFailed {
				reason = "node_failure"
			}
			events = append(events, SpanEvent{
				Timestamp: entry,
				Name:      "exception",
				Attributes: map[string]any{
					"exception.message": fmt.Sprintf("Span completed with error: %s", reason),
					"exception.type":    reason,
				},
			})
		}
		if n.RetryCount > 0 {
			events = append(events, SpanEvent{
				Timestamp: entry,
				Name:      "retry.storm",
				Attributes: map[string]any{
					"retry.count": n.RetryCount,
				},
			})
		}

		// Span links for async producer→consumer
		var links []SpanLink
		if isAsync && len(edgeOutMap) > 0 {
			if outEdges, ok := edgeOutMap[n.ID]; ok {
				for _, e := range outEdges {
					links = append(links, SpanLink{
						TraceID: traceID,
						SpanID:  spanID,
						Attributes: map[string]any{
							"edge.id":      e.ID,
							"edge.target":  e.Target,
						},
					})
				}
			}
		}

		spans = append(spans, Span{
			SpanID:       spanID,
			TraceID:      traceID,
			ParentSpanID: parentSpanID,
			NodeID:       n.ID,
			NodeLabel:    n.Label,
			NodeType:     string(n.NodeType),
			EntryTime:    entry,
			ExitTime:     exit,
			DurationMs:   latency,
			Status:       status,
			SpanType:     spanType,
			ServiceName:      n.Label,
			TelemetrySDKName: "opentelemetry",
			Attributes:       attrs,
			Events:           events,
			Links:            links,
		})
		parentSpanID = spanID

		// ── Generate structured log for this span ──
		level := LogLevelInfo
		msg := "Request processed"
		if isAsync && level == LogLevelInfo {
			asyncWaitMs := n.QueueDepth * 100  // approximate from tick duration
			if asyncWaitMs > 10000 {
				asyncWaitMs = 10000
			}
			msg = fmt.Sprintf("Async wait %.0fms", asyncWaitMs)
		}
		if n.IsFailed {
			level = LogLevelCritical
			msg = "Health check failed"
		} else if status == SpanStatusERROR {
			level = LogLevelError
			msg = fmt.Sprintf("Error rate %.1f%%", n.ErrorRate*100)
		} else if n.RetryCount > 0 {
			level = LogLevelWarn
			msg = fmt.Sprintf("Retry attempt %d", n.RetryCount)
			if n.RetryCount > 1 {
				msg = fmt.Sprintf("Retry attempt %d (escalated)", n.RetryCount)
			}
		}

		if logs != nil {
			*logs = append(*logs, SimLog{
				Timestamp:  entry,
				TraceID:    traceID,
				SpanID:     spanID,
				Service:    n.Label,
				Level:      level,
				Message:    msg,
				DurationMs: latency,
				NodeID:     n.ID,
			})
		}
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

func (e *Engine) annotateChaosEvents(trace Trace, tickNum int) Trace {
	e.mu.RLock()
	cm := e.chaos
	runID := e.RunID
	e.mu.RUnlock()
	if cm == nil {
		return trace
	}
	activeEvents := cm.ActiveEvents(runID)
	if len(activeEvents) == 0 {
		return trace
	}

	chaosByNode := make(map[string]*ChaosEvent)
	for _, ce := range activeEvents {
		chaosByNode[ce.NodeID] = ce
	}

	for i := range trace.Spans {
		s := &trace.Spans[i]
		ce, ok := chaosByNode[s.NodeID]
		if !ok {
			continue
		}
		evt := SpanEvent{
			Timestamp: s.EntryTime,
			Name:      "chaos." + string(ce.EventType),
			Attributes: map[string]any{
				"chaos.event_id":    ce.ID,
				"chaos.event_type":  string(ce.EventType),
				"chaos.severity":    ce.Severity,
				"chaos.duration_ticks": ce.DurationTicks,
				"chaos.started_at":  ce.StartedAt,
			},
		}
		s.Events = append(s.Events, evt)
	}
	return trace
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

type LogCollector struct {
	mu   sync.RWMutex
	logs []SimLog
	max  int
}

func NewLogCollector(max int) *LogCollector {
	return &LogCollector{
		logs: make([]SimLog, 0, max),
		max:  max,
	}
}

func (lc *LogCollector) Add(entry SimLog) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.logs = append(lc.logs, entry)
	if len(lc.logs) > lc.max {
		lc.logs = lc.logs[len(lc.logs)-lc.max:]
	}
}

func (lc *LogCollector) AddAll(entries []SimLog) {
	if len(entries) == 0 {
		return
	}
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.logs = append(lc.logs, entries...)
	if len(lc.logs) > lc.max {
		lc.logs = lc.logs[len(lc.logs)-lc.max:]
	}
}

func (lc *LogCollector) All() []SimLog {
	lc.mu.RLock()
	defer lc.mu.RUnlock()
	result := make([]SimLog, len(lc.logs))
	copy(result, lc.logs)
	return result
}

func (lc *LogCollector) Filter(service, level, traceID string) []SimLog {
	all := lc.All()
	if service == "" && level == "" && traceID == "" {
		return all
	}
	filtered := make([]SimLog, 0, len(all))
	for _, entry := range all {
		if service != "" && entry.Service != service {
			continue
		}
		if level != "" && string(entry.Level) != level {
			continue
		}
		if traceID != "" && entry.TraceID != traceID {
			continue
		}
		filtered = append(filtered, entry)
	}
	return filtered
}

func (e *Engine) generateTraces(tickTime time.Time) {
	e.mu.RLock()
	ctx := e.ctx
	tickNum := e.tickNum
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

	var allLogs []SimLog

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
		var traceLogs []SimLog
		trace := NewTraceFromNodes(traceID, path, nodeMap, tickTime, ctx.Edges, ctx.EdgeOutMap, &traceLogs)

		// Add chaos failure span events
		trace = e.annotateChaosEvents(trace, tickNum)

		e.mu.RLock()
		collector := e.TraceCollector
		e.mu.RUnlock()
		if collector != nil {
			collector.Add(trace)
		}
		allLogs = append(allLogs, traceLogs...)
	}

	// Also generate logs for ALL nodes (not just traced ones)
	for id, n := range nodeMap {
		if n.CurrentRPS <= 0 {
			continue
		}
		// Skip nodes already covered by trace logs
		alreadyLogged := false
		for _, l := range allLogs {
			if l.NodeID == id {
				alreadyLogged = true
				break
			}
		}
		if alreadyLogged {
			continue
		}

		syntheticTraceID := ""
		syntheticSpanID := uuid.New().String()
		level := LogLevelInfo
		msg := "Request processed"
		latency := n.P99LatencyMs
		if latency <= 0 {
			latency = n.LatencyMs
		}

		if n.IsFailed {
			level = LogLevelCritical
			msg = "Health check failed"
		} else if n.ErrorRate > 0.05 {
			level = LogLevelError
			msg = fmt.Sprintf("Error rate %.1f%%", n.ErrorRate*100)
		} else if n.RetryCount > 0 {
			level = LogLevelWarn
			msg = fmt.Sprintf("Retry attempt %d", n.RetryCount)
		} else if IsAsyncNodeType(n.NodeType) {
			asyncWaitMs := n.QueueDepth * 100
			if asyncWaitMs > 10000 {
				asyncWaitMs = 10000
			}
			msg = fmt.Sprintf("Async wait %.0fms", asyncWaitMs)
		}

		allLogs = append(allLogs, SimLog{
			Timestamp:  tickTime,
			TraceID:    syntheticTraceID,
			SpanID:     syntheticSpanID,
			Service:    n.Label,
			Level:      level,
			Message:    msg,
			DurationMs: latency,
			NodeID:     n.ID,
		})
	}

	e.mu.RLock()
	logCollector := e.LogCollector
	e.mu.RUnlock()
	if logCollector != nil {
		logCollector.AddAll(allLogs)
	}
}
