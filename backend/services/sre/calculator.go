package sre

import (
	"math"
	"systemdesign/simulation"
)

const (
	WindowSeconds = 30 * 24 * 3600 // 30 days in seconds

	// FastBurnThreshold: if the burn rate exceeds this, the error budget
	// would be exhausted in 2 days (30 / 14.4 ≈ 2.08 days).
	FastBurnThreshold = 14.4

	// SlowBurnThreshold: if the burn rate exceeds this, the error budget
	// would be exhausted in 30 days.
	SlowBurnThreshold = 1.0
)

type NodeSLOStatus struct {
	NodeID               string  `json:"nodeId"`
	SLOTargetMs          float64 `json:"sloTargetMs"`
	SLOAvailabilityTarget float64 `json:"sloAvailabilityTarget"`
	ActualLatencyMs      float64 `json:"actualLatencyMs"`
	ActualErrorRate      float64 `json:"actualErrorRate"`
	LatencyBudgetRemaining  float64 `json:"latencyBudgetRemainingPercent"`
	AvailabilityBudgetRemaining float64 `json:"availabilityBudgetRemainingPercent"`
	BurnRate             float64 `json:"burnRate"`
	Status               string  `json:"status"` // "healthy" | "slow_burn" | "fast_burn"
}

type SLOReport struct {
	WindowSeconds int            `json:"windowSeconds"`
	Nodes         []NodeSLOStatus `json:"nodes"`
}

// ErrorBudgetRemaining calculates how much error budget is left
// given the actual error rate and the SLO availability target.
// Returns a value 0–100 representing percent of budget remaining.
func ErrorBudgetRemaining(actualErrorRate, sloAvailabilityTarget float64) float64 {
	if sloAvailabilityTarget <= 0 {
		return 100
	}
	allowedErrorRate := 1 - sloAvailabilityTarget
	if allowedErrorRate <= 0 {
		return 100
	}
	budget := math.Max(0, (allowedErrorRate-actualErrorRate)/allowedErrorRate)
	return math.Round(budget*1000) / 10 // one decimal place
}

// BurnRate calculates how fast the error budget is being consumed
// relative to the allowed rate. A value of 1.0 means budget lasts 30 days;
// 14.4 means it lasts ~2 days.
func BurnRate(actualErrorRate, sloAvailabilityTarget float64) float64 {
	if sloAvailabilityTarget <= 0 {
		return 0
	}
	allowedErrorRate := 1 - sloAvailabilityTarget
	if allowedErrorRate <= 0 {
		return 0
	}
	return math.Round((actualErrorRate/allowedErrorRate)*100) / 100
}

// ClassifyBurnRate returns the status string for a given burn rate.
func ClassifyBurnRate(rate float64) string {
	if rate >= FastBurnThreshold {
		return "fast_burn"
	}
	if rate >= SlowBurnThreshold {
		return "slow_burn"
	}
	return "healthy"
}

// GenerateSLOReport builds a per-node SLO report from a completed engine's ticks.
func GenerateSLOReport(engine *simulation.Engine) *SLOReport {
	ticks := engine.Ticks()
	config := engine.Config()

	// Aggregate node metrics across all ticks
	type agg struct {
		latencySum  float64
		latencyMax  float64
		errorSum    float64
		requestSum  float64
		count       int
		sloLatency  float64
		sloAvail    float64
	}
	nodeAgg := make(map[string]*agg)

	for _, tick := range ticks {
		for _, m := range tick.NodeMetrics {
			a, ok := nodeAgg[m.NodeID]
			if !ok {
				a = &agg{
					sloLatency: m.SLOTargetMs,
					sloAvail:   m.SLOAvailabilityTarget,
				}
				nodeAgg[m.NodeID] = a
			}
			a.latencySum += m.P99LatencyMs
			a.latencyMax = math.Max(a.latencyMax, m.P99LatencyMs)
			a.errorSum += m.ErrorCount
			a.requestSum += m.IncomingRPS
			a.count++
		}
		// Also grab SLO config from the config nodes if not set
		if len(tick.NodeMetrics) > 0 {
			for _, m := range tick.NodeMetrics {
				a := nodeAgg[m.NodeID]
				if a != nil && a.sloLatency <= 0 {
					for _, cn := range config.Nodes {
						if cn.ID == m.NodeID {
							a.sloLatency = cn.SLOTargetMs
							a.sloAvail = cn.SLOAvailabilityTarget
							break
						}
					}
				}
			}
		}
	}

	// Also populate from config nodes directly
	for _, cn := range config.Nodes {
		if _, ok := nodeAgg[cn.ID]; !ok {
			nodeAgg[cn.ID] = &agg{
				sloLatency: cn.SLOTargetMs,
				sloAvail:   cn.SLOAvailabilityTarget,
				count:      1,
			}
		}
	}

	nodes := make([]NodeSLOStatus, 0, len(nodeAgg))
	for nodeID, a := range nodeAgg {
		avgLatency := 0.0
		if a.count > 0 {
			avgLatency = a.latencySum / float64(a.count)
		}

		actualErrorRate := 0.0
		if a.requestSum > 0 {
			actualErrorRate = a.errorSum / a.requestSum
		}

		budgetRemaining := ErrorBudgetRemaining(actualErrorRate, a.sloAvail)
		burnRate := BurnRate(actualErrorRate, a.sloAvail)
		status := ClassifyBurnRate(burnRate)

		// Use max latency as the actual for reporting
		actualLatency := a.latencyMax
		if actualLatency <= 0 {
			actualLatency = avgLatency
		}

		// Latency budget: how close is actual p99 to the SLO target
		latencyBudget := 100.0
		if a.sloLatency > 0 {
			latencyBudget = math.Max(0, (1-actualLatency/a.sloLatency)*100)
			latencyBudget = math.Round(latencyBudget*10) / 10
		}

		nodes = append(nodes, NodeSLOStatus{
			NodeID:               nodeID,
			SLOTargetMs:          a.sloLatency,
			SLOAvailabilityTarget: a.sloAvail,
			ActualLatencyMs:      math.Round(actualLatency*100) / 100,
			ActualErrorRate:      math.Round(actualErrorRate*10000) / 10000,
			LatencyBudgetRemaining:  latencyBudget,
			AvailabilityBudgetRemaining: budgetRemaining,
			BurnRate:             burnRate,
			Status:               status,
		})
	}

	return &SLOReport{
		WindowSeconds: WindowSeconds,
		Nodes:         nodes,
	}
}
