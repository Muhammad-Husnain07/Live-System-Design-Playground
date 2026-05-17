package simulation

import "time"

func SnapshotTick(tickNum int, nodes []Node, edges []Edge) Tick {
	metrics := make([]NodeMetricsSnapshot, 0, len(nodes))
	totalRPS := 0.0
	totalErrors := 0.0
	totalRequests := 0.0

	for _, n := range nodes {
		snapshot := NodeMetricsSnapshot{
			NodeID:        n.ID,
			NodeType:      n.NodeType,
			Label:         n.Label,
			IncomingRPS:   n.IncomingRPS,
			CurrentRPS:    n.CurrentRPS,
			CanaryRPS:     n.CanaryRPS,
			MaxRPS:        n.MaxRPS,
			Instances:     n.Instances,
			LatencyMs:     n.P99LatencyMs,
			ErrorRate:     n.ErrorRate,
			QueueDepth:    n.QueueDepth,
			IsBottleneck:  n.IsBottleneck,
			OverflowRPS:   n.OverflowRPS,
			CPUPercent:    n.CPUPercent,
			MemoryPercent: n.MemoryPercent,
			ErrorCount:    n.ErrorCount,
			P99LatencyMs:  n.P99LatencyMs,
			IsFailed:      n.IsFailed,
			IsAsync:       IsAsyncNodeType(n.NodeType),
		}
		metrics = append(metrics, snapshot)

		totalRPS += n.CurrentRPS
		totalErrors += n.ErrorCount
		totalRequests += n.IncomingRPS
	}

	globalErrorRate := 0.0
	if totalRequests > 0 {
		globalErrorRate = (totalErrors / totalRequests) * 100
	}

	activeRequests := 0.0
	for _, n := range nodes {
		capacity := float64(n.Instances) * n.MaxRPS
		if capacity > 0 {
			util := n.CurrentRPS / capacity
			if util > 1 {
				util = 1
			}
			activeRequests += n.LatencyMs * n.CurrentRPS / 1000.0
		}
	}

	return Tick{
		TickNumber:      tickNum,
		Timestamp:       time.Now(),
		NodeMetrics:     metrics,
		TotalRPS:        mathRound(totalRPS, 2),
		GlobalErrorRate: mathRound(globalErrorRate, 2),
		ActiveRequests:  mathRound(activeRequests, 0),
	}
}

func mathRound(v float64, decimals int) float64 {
	pow := 1.0
	for i := 0; i < decimals; i++ {
		pow *= 10
	}
	return float64(int64(v*pow+0.5)) / pow
}
