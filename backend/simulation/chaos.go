package simulation

import (
	"math"
	"sync"
)

type ChaosEventType string

const (
	ChaosNodeFailure      ChaosEventType = "NodeFailure"
	ChaosLatencySpike     ChaosEventType = "LatencySpike"
	ChaosErrorRateSpike   ChaosEventType = "ErrorRateSpike"
	ChaosNetworkPartition ChaosEventType = "NetworkPartition"
	ChaosDDoS             ChaosEventType = "DDoS"
	ChaosRegionDown       ChaosEventType = "RegionDown"
	ChaosMemoryLeak       ChaosEventType = "MemoryLeak"
	ChaosCPUSaturation    ChaosEventType = "CPUSaturation"
	ChaosSplitBrain       ChaosEventType = "SplitBrain"
)

var ValidChaosTypes = map[ChaosEventType]bool{
	ChaosNodeFailure:      true,
	ChaosLatencySpike:     true,
	ChaosErrorRateSpike:   true,
	ChaosNetworkPartition: true,
	ChaosDDoS:             true,
	ChaosRegionDown:       true,
	ChaosMemoryLeak:       true,
	ChaosCPUSaturation:    true,
	ChaosSplitBrain:       true,
}

func IsValidChaosType(ct ChaosEventType) bool {
	return ValidChaosTypes[ct]
}

type ChaosEvent struct {
	ID              string         `json:"id"`
	SimulationRunID string         `json:"simulationRunId"`
	NodeID          string         `json:"nodeId"`
	EventType       ChaosEventType `json:"eventType"`
	Severity        float64        `json:"severity"`
	DurationTicks   int            `json:"durationTicks"`
	StartedAt       int            `json:"startedAt"`
	Active          bool           `json:"active"`
}

type ChaosManager struct {
	mu     sync.RWMutex
	events map[string]map[string]*ChaosEvent
}

func NewChaosManager() *ChaosManager {
	return &ChaosManager{
		events: make(map[string]map[string]*ChaosEvent),
	}
}

func (cm *ChaosManager) Inject(event *ChaosEvent) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if cm.events[event.SimulationRunID] == nil {
		cm.events[event.SimulationRunID] = make(map[string]*ChaosEvent)
	}
	cm.events[event.SimulationRunID][event.ID] = event
}

func (cm *ChaosManager) RemoveEvent(runID, eventID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if events, ok := cm.events[runID]; ok {
		delete(events, eventID)
		if len(events) == 0 {
			delete(cm.events, runID)
		}
	}
}

func (cm *ChaosManager) ActiveEvents(runID string) []*ChaosEvent {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	events, ok := cm.events[runID]
	if !ok {
		return nil
	}
	result := make([]*ChaosEvent, 0, len(events))
	for _, e := range events {
		if e.Active {
			result = append(result, e)
		}
	}
	return result
}

func (cm *ChaosManager) ClearRun(runID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	delete(cm.events, runID)
}

func (cm *ChaosManager) ApplyPreTick(runID string, nodeMap map[string]*Node, tickNum int) {
	cm.mu.RLock()
	events, ok := cm.events[runID]
	if !ok || len(events) == 0 {
		cm.mu.RUnlock()
		return
	}

	var toRemove []string
	for _, ev := range events {
		if !ev.Active {
			continue
		}
		elapsed := tickNum - ev.StartedAt
		if ev.DurationTicks > 0 && elapsed >= ev.DurationTicks {
			toRemove = append(toRemove, ev.ID)
			continue
		}

		n, found := nodeMap[ev.NodeID]
		if !found {
			continue
		}
		cm.ApplyOne(n, ev)
	}
	cm.mu.RUnlock()

	if len(toRemove) > 0 {
		cm.mu.Lock()
		for _, id := range toRemove {
			if e, ok := cm.events[runID][id]; ok {
				e.Active = false
			}
		}
		cm.mu.Unlock()
	}
}

func (cm *ChaosManager) ApplyPostTick(runID string, nodeMap map[string]*Node) {
	cm.mu.RLock()
	events, ok := cm.events[runID]
	if !ok || len(events) == 0 {
		cm.mu.RUnlock()
		return
	}

	for _, ev := range events {
		if !ev.Active {
			continue
		}
		if ev.EventType != ChaosMemoryLeak {
			continue
		}
		n, found := nodeMap[ev.NodeID]
		if !found {
			continue
		}
		n.MemoryPercent = math.Min(50+n.MemoryPercent*ev.Severity*0.5, 100)
		n.CPUPercent = math.Min(n.CPUPercent*(1+ev.Severity*0.3), 100)
	}
	cm.mu.RUnlock()
}

func (cm *ChaosManager) ApplyOne(n *Node, ev *ChaosEvent) {
	switch ev.EventType {
	case ChaosNodeFailure:
		n.IsFailed = true

	case ChaosLatencySpike:
		factor := 1.0 + ev.Severity*9.0
		n.LatencyMs = n.LatencyMs * factor
		if n.LatencyMs < 1 {
			n.LatencyMs = 1
		}
		// Jitter Bomb mode: at severity >= 0.7, spike jitter to 500ms
		// simulating noisy neighbor problems in cloud environments.
		// This causes erratic latency variance and packet reordering.
		if ev.Severity >= 0.7 {
			// Jitter spikes to severity * 500ms (at 0.7: 350ms, at 1.0: 500ms)
			jitterSpike := ev.Severity * 500.0
			// This jitter is applied by the propagator's edge-level jitter logic
			// We encode it as a persistent latency multiplier effect
			n.LatencyMs = n.LatencyMs + jitterSpike*0.5
		}

	case ChaosErrorRateSpike:
		newRate := math.Min(ev.Severity, 1.0)
		if newRate > n.ErrorRate {
			n.ErrorRate = newRate
		}

	case ChaosNetworkPartition:
		// Degraded mode: at severity 1.0, drop 100% of packets (total partition).
		// At lower severity, drop proportionally — simulating degraded network.
		dropPercent := ev.Severity * 100.0
		if dropPercent >= 99.0 {
			n.Instances = 0
			n.MaxRPS = 0
		} else {
			// For degraded partitions, use ErrorRate to simulate partial packet loss.
			newErrorRate := ev.Severity * 0.8
			if newErrorRate > n.ErrorRate {
				n.ErrorRate = newErrorRate
			}
			// Reduce instances to simulate degraded capacity
			n.Instances = int(math.Max(1, float64(n.Instances)*(1.0-ev.Severity*0.5)))
		}

	case ChaosDDoS:
		factor := 1.0 - ev.Severity*0.9
		n.MaxRPS = n.MaxRPS * factor
		if n.MaxRPS < 1 {
			n.MaxRPS = 1
		}
		n.Instances = int(math.Max(1, float64(n.Instances)*factor))
		n.ErrorRate = math.Max(n.ErrorRate, ev.Severity*0.3)

	case ChaosRegionDown:
		n.IsFailed = true
		n.MaxRPS = 0
		n.Instances = 0

	case ChaosCPUSaturation:
		factor := 1.0 - ev.Severity*0.95
		n.MaxRPS = n.MaxRPS * factor
		if n.MaxRPS < 1 {
			n.MaxRPS = 1
		}
		n.CPUPercent = 95.0
		n.MemoryPercent = math.Min(50+ev.Severity*40, 95)

	case ChaosMemoryLeak:
		n.ErrorRate = math.Min(0.05*ev.Severity+n.ErrorRate, 0.5)
		n.LatencyMs = n.LatencyMs * (1.0 + ev.Severity*0.1)

	case ChaosSplitBrain:
		if !isDatabaseNode(n.NodeType) {
			break
		}
		n.IsSplitBrain = true
		n.DataInconsistency += ev.Severity * 1000.0
		if n.ReplicationRole == "primary" {
			// Primary loses write quorum; most writes fail
			n.ErrorRate = math.Min(n.ErrorRate+ev.Severity*0.6, 0.95)
		} else if n.ReplicationRole == "replica" {
			// Replica promotes itself to primary, creating two primaries
			n.ReplicationRole = "primary"
			// Conflict resolution adds latency
			n.LatencyMs = n.LatencyMs * (1.0 + ev.Severity*0.5)
		}
	}
}
