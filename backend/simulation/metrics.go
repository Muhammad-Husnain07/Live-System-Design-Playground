package simulation

import "time"

func SnapshotTick(tickNum int, nodes []Node, edges []Edge, depMgr *DeploymentManager) Tick {
	metrics := make([]NodeMetricsSnapshot, 0, len(nodes))
	totalRPS := 0.0
	totalErrors := 0.0
	totalRequests := 0.0

	depStates := make(map[string]*NodeDeploymentState)
	if depMgr != nil {
		for _, s := range depMgr.AllStates() {
			depStates[s.NodeID] = s
		}
	}

	for _, n := range nodes {
		activeGroup := ""
		blueGreenGroup := ""
		if ds, ok := depStates[n.ID]; ok {
			activeGroup = ds.ActiveGroup
			blueGreenGroup = ds.BlueGreenGroup
		}

		// Compute SLI breaches
		latencyOK := n.SLOTargetMs <= 0 || n.P99LatencyMs <= n.SLOTargetMs
		availOK := n.SLOAvailabilityTarget <= 0 || n.ErrorRate <= (1-n.SLOAvailabilityTarget)

		snapshot := NodeMetricsSnapshot{
			NodeID:            n.ID,
			NodeType:          n.NodeType,
			Label:             n.Label,
			IncomingRPS:       n.IncomingRPS,
			CurrentRPS:        n.CurrentRPS,
			CanaryRPS:         n.CanaryRPS,
			MaxRPS:            n.MaxRPS,
			Instances:         n.Instances,
			LatencyMs:         n.P99LatencyMs,
			ErrorRate:         n.ErrorRate,
			QueueDepth:        n.QueueDepth,
			IsBottleneck:      n.IsBottleneck,
			OverflowRPS:       n.OverflowRPS,
			CPUPercent:        n.CPUPercent,
			MemoryPercent:     n.MemoryPercent,
			ErrorCount:        n.ErrorCount,
			P99LatencyMs:      n.P99LatencyMs,
			IsFailed:          n.IsFailed,
			IsAsync:           IsAsyncNodeType(n.NodeType),
			ActiveGroup:       activeGroup,
			BlueGreenGroup:    blueGreenGroup,
			RetryCount:        n.RetryCount,
			DroppedRequests:   n.DroppedRequests,
			CacheHitRatio:     n.CacheHitRatio,
			ConnectionPoolMax: n.ConnectionPoolMax,
			ColdStartMs:       n.ColdStartMs,
			DiskIOPSMax:       n.DiskIOPSMax,
			IsPrimaryDB:       n.IsPrimaryDB,
			ActiveConnections: n.ActiveConnections,
			DesiredInstances:  n.DesiredInstances,
			ScalingEvent:      n.ScalingEvent,
			ComputeTier:       n.ComputeTier,
			ReplicationRole:   n.ReplicationRole,
			ReplicationLagMs:  n.ReplicationLagMs,
			StaleReadCount:    n.StaleReadCount,
			IsSplitBrain:      n.IsSplitBrain,
			DataInconsistency: n.DataInconsistency,
			SpotInterrupted:   n.SpotInterrupted,
			Region:            n.Region,
			RagQueryTokens:       n.RagQueryTokens,
			RagContextTokens:     n.RagContextTokens,
			ActiveWorkflows:      n.ActiveWorkflows,
			FailedWorkflows:      n.FailedWorkflows,
			CompensationEvents:   n.CompensationEvents,
			SLOTargetMs:          n.SLOTargetMs,
			SLOAvailabilityTarget: n.SLOAvailabilityTarget,
			IsLatencyBreached:    !latencyOK,
			IsAvailabilityBreached: !availOK,
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
