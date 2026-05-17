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
		cm.applyOne(n, ev)
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

func (cm *ChaosManager) applyOne(n *Node, ev *ChaosEvent) {
	switch ev.EventType {
	case ChaosNodeFailure:
		n.IsFailed = true

	case ChaosLatencySpike:
		factor := 1.0 + ev.Severity*9.0
		n.LatencyMs = n.LatencyMs * factor
		if n.LatencyMs < 1 {
			n.LatencyMs = 1
		}

	case ChaosErrorRateSpike:
		newRate := math.Min(ev.Severity, 1.0)
		if newRate > n.ErrorRate {
			n.ErrorRate = newRate
		}

	case ChaosNetworkPartition:
		n.Instances = 0
		n.MaxRPS = 0

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
	}
}
