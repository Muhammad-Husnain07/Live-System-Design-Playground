package simulation

import "encoding/json"

type IncidentScenario struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Steps       []IncidentStep `json:"steps"`
}

type IncidentStep struct {
	TriggerTick int              `json:"triggerTick"`
	Action      string           `json:"action"`
	Payload     json.RawMessage  `json:"payload"`
}

var Scenarios = []IncidentScenario{
	{
		ID:          "retry-storm",
		Name:        "The Retry Storm",
		Description: "A downstream service becomes slow, triggering cascading retries that overwhelm upstream caches and databases, leading to a system-wide latency collapse.",
		Steps: []IncidentStep{
			{TriggerTick: 5, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"AppServer","changes":{"latencyMs":800,"errorRate":0.15}}`)},
			{TriggerTick: 5, Action: "chaos_inject", Payload: json.RawMessage(`{"eventType":"LatencySpike","severity":0.8,"durationTicks":20,"targetNodeType":"AppServer"}`)},
			{TriggerTick: 12, Action: "traffic_spike", Payload: json.RawMessage(`{"multiplier":3.0,"durationTicks":10}`)},
			{TriggerTick: 25, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"AppServer","changes":{"latencyMs":50,"errorRate":0.01}}`)},
		},
	},
	{
		ID:          "cache-avalanche",
		Name:        "The Cache Avalanche",
		Description: "A Redis cache cluster fails, redirecting all read traffic to the primary database. The sudden load causes connection pool exhaustion and replication lag.",
		Steps: []IncidentStep{
			{TriggerTick: 5, Action: "chaos_inject", Payload: json.RawMessage(`{"eventType":"NodeFailure","severity":1.0,"durationTicks":25,"targetNodeType":"Redis"}`)},
			{TriggerTick: 5, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"Redis","changes":{"cacheHitRatio":0}}`)},
			{TriggerTick: 8, Action: "traffic_spike", Payload: json.RawMessage(`{"multiplier":2.5,"durationTicks":15}`)},
			{TriggerTick: 20, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"Redis","changes":{"cacheHitRatio":0.85}}`)},
		},
	},
	{
		ID:          "noisy-neighbor",
		Name:        "The Noisy Neighbor",
		Description: "A rogue microservice consumes all CPU on a shared node, starving co-located services and causing cascading timeouts across the mesh.",
		Steps: []IncidentStep{
			{TriggerTick: 5, Action: "chaos_inject", Payload: json.RawMessage(`{"eventType":"CPUSaturation","severity":0.9,"durationTicks":20,"targetNodeType":"Microservice"}`)},
			{TriggerTick: 8, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"Microservice","changes":{"maxRPS":50,"instances":1}}`)},
			{TriggerTick: 18, Action: "config_change", Payload: json.RawMessage(`{"targetNodeType":"Microservice","changes":{"maxRPS":2000,"instances":3}}`)},
		},
	},
}

type chaosInjectPayload struct {
	EventType      ChaosEventType `json:"eventType"`
	Severity       float64        `json:"severity"`
	DurationTicks  int            `json:"durationTicks"`
	TargetNodeType NodeType       `json:"targetNodeType"`
}

type trafficSpikePayload struct {
	Multiplier    float64 `json:"multiplier"`
	DurationTicks int     `json:"durationTicks"`
}

type configChangePayload struct {
	TargetNodeType NodeType        `json:"targetNodeType"`
	Changes        map[string]any `json:"changes"`
}
