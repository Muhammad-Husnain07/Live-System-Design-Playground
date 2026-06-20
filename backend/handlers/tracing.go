package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"systemdesign/simulation"
)

type LogsQuery struct {
	Service string `query:"service"`
	Level   string `query:"level"`
	TraceID string `query:"traceId"`
	Page    int    `query:"page"`
	PerPage int    `query:"perPage"`
}

type otelSpanEvent struct {
	Timestamp  string         `json:"timestamp"`
	Name       string         `json:"name"`
	Attributes map[string]any `json:"attributes,omitempty"`
}

type otelSpanLink struct {
	TraceID    string         `json:"traceId"`
	SpanID     string         `json:"spanId"`
	Attributes map[string]any `json:"attributes,omitempty"`
}

type otelAttribute struct {
	Key   string      `json:"key"`
	Value otelValue   `json:"value"`
}

type otelValue struct {
	StringValue string `json:"stringValue,omitempty"`
	IntValue    int64  `json:"intValue,omitempty"`
	DoubleValue float64 `json:"doubleValue,omitempty"`
	BoolValue   bool   `json:"boolValue,omitempty"`
}

type otelSpan struct {
	TraceID           string           `json:"traceId"`
	SpanID            string           `json:"spanId"`
	ParentSpanID      string           `json:"parentSpanId,omitempty"`
	Name              string           `json:"name"`
	Kind              int              `json:"kind"`
	StartTimeUnixNano int64            `json:"startTimeUnixNano"`
	EndTimeUnixNano   int64            `json:"endTimeUnixNano"`
	Attributes        []otelAttribute  `json:"attributes,omitempty"`
	Events            []otelSpanEvent  `json:"events,omitempty"`
	Links             []otelSpanLink   `json:"links,omitempty"`
	Status            otelStatus       `json:"status"`
}

type otelStatus struct {
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
}

type otelScopeSpan struct {
	Scope otelScope  `json:"scope"`
	Spans []otelSpan `json:"spans"`
}

type otelScope struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type otelResourceSpan struct {
	Resource   otelResource   `json:"resource"`
	ScopeSpans []otelScopeSpan `json:"scopeSpans"`
}

type otelResource struct {
	Attributes []otelAttribute `json:"attributes"`
}

type otelTraceResponse struct {
	ResourceSpans []otelResourceSpan `json:"resourceSpans"`
}

func toOTelAttributes(m map[string]any) []otelAttribute {
	if len(m) == 0 {
		return nil
	}
	attrs := make([]otelAttribute, 0, len(m))
	for k, v := range m {
		attr := otelAttribute{Key: k}
		switch val := v.(type) {
		case string:
			attr.Value = otelValue{StringValue: val}
		case float64:
			attr.Value = otelValue{DoubleValue: val}
		case int:
			attr.Value = otelValue{IntValue: int64(val)}
		case bool:
			attr.Value = otelValue{BoolValue: val}
		default:
			attr.Value = otelValue{StringValue: fmt.Sprintf("%v", val)}
		}
		attrs = append(attrs, attr)
	}
	return attrs
}

func toOTelSpanEvents(events []simulation.SpanEvent) []otelSpanEvent {
	if len(events) == 0 {
		return nil
	}
	out := make([]otelSpanEvent, len(events))
	for i, e := range events {
		out[i] = otelSpanEvent{
			Timestamp:  e.Timestamp.Format(time.RFC3339Nano),
			Name:       e.Name,
			Attributes: e.Attributes,
		}
	}
	return out
}

func toOTelSpanLinks(links []simulation.SpanLink) []otelSpanLink {
	if len(links) == 0 {
		return nil
	}
	out := make([]otelSpanLink, len(links))
	for i, l := range links {
		out[i] = otelSpanLink{
			TraceID:    l.TraceID,
			SpanID:     l.SpanID,
			Attributes: l.Attributes,
		}
	}
	return out
}

func toOTelSpan(s simulation.Span) otelSpan {
	statusCode := 0 // Unset
	statusMsg := ""
	if s.Status == simulation.SpanStatusOK {
		statusCode = 1 // OK
	} else if s.Status == simulation.SpanStatusERROR {
		statusCode = 2 // Error
		statusMsg = "span completed with error"
	}

	kind := 1 // Internal
	if s.SpanType == simulation.SpanTypeAsync {
		kind = 4 // Producer
	}

	span := otelSpan{
		TraceID:           s.TraceID,
		SpanID:            s.SpanID,
		ParentSpanID:      s.ParentSpanID,
		Name:              s.NodeLabel,
		Kind:              kind,
		StartTimeUnixNano: s.EntryTime.UnixNano(),
		EndTimeUnixNano:   s.ExitTime.UnixNano(),
		Attributes:        toOTelAttributes(s.Attributes),
		Events:            toOTelSpanEvents(s.Events),
		Links:             toOTelSpanLinks(s.Links),
		Status: otelStatus{
			Code:    statusCode,
			Message: statusMsg,
		},
	}

	// Add OTel semantic convention attributes
	span.Attributes = append(span.Attributes,
		otelAttribute{Key: "service.name", Value: otelValue{StringValue: s.ServiceName}},
		otelAttribute{Key: "telemetry.sdk.name", Value: otelValue{StringValue: s.TelemetrySDKName}},
	)
	if s.NetSockPeerAddr != "" {
		span.Attributes = append(span.Attributes,
			otelAttribute{Key: "net.sock.peer.addr", Value: otelValue{StringValue: s.NetSockPeerAddr}},
		)

	}

	return span
}

func (h *SimulationHandler) GetTraces(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	h.mu.Lock()
	engine, ok := h.engines[runID]
	h.mu.Unlock()

	if !ok {
		engine = h.findEngineFromDB(runID)
		if engine == nil {
			return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
		}
	}

	if engine.TraceCollector == nil {
		return c.JSON(fiber.Map{"traces": []simulation.Trace{}})
	}

	traces := engine.TraceCollector.Recent()
	if traces == nil {
		traces = []simulation.Trace{}
	}
	return c.JSON(fiber.Map{"traces": traces})
}

func (h *SimulationHandler) GetLogs(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var q LogsQuery
	if err := c.QueryParser(&q); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
	}

	h.mu.Lock()
	engine, ok := h.engines[runID]
	h.mu.Unlock()

	if !ok {
		engine = h.findEngineFromDB(runID)
		if engine == nil {
			return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
		}
	}

	if engine.LogCollector == nil {
		return c.JSON(fiber.Map{"logs": []any{}, "total": 0, "page": q.Page, "perPage": q.PerPage})
	}

	allLogs := engine.LogCollector.Filter(q.Service, q.Level, q.TraceID)
	total := len(allLogs)

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PerPage <= 0 || q.PerPage > 1000 {
		q.PerPage = 100
	}

	start := (q.Page - 1) * q.PerPage
	if start >= total || start < 0 {
		allLogs = []simulation.SimLog{}
	} else {
		end := start + q.PerPage
		if end > total {
			end = total
		}
		allLogs = allLogs[start:end]
	}

	if allLogs == nil {
		allLogs = []simulation.SimLog{}
	}

	return c.JSON(fiber.Map{
		"logs":    allLogs,
		"total":   total,
		"page":    q.Page,
		"perPage": q.PerPage,
	})
}
