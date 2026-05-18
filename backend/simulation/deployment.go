package simulation

import "sync"

type NodeDeploymentState struct {
	NodeID        string
	Strategy      DeploymentStrategy
	CanaryPercent float64
	CanaryActive  bool
	CanaryFailed  bool

	// Blue/green
	BlueGreenGroup string // "blue", "green", or ""
	ActiveGroup    string // which group is currently serving ("blue" or "green")
}

type DeploymentManager struct {
	mu     sync.RWMutex
	states map[string]*NodeDeploymentState
}

func NewDeploymentManager() *DeploymentManager {
	return &DeploymentManager{
		states: make(map[string]*NodeDeploymentState),
	}
}

func (dm *DeploymentManager) InitFromNodes(nodes []Node) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	for _, n := range nodes {
		ds := &NodeDeploymentState{
			NodeID:         n.ID,
			Strategy:       n.Deployment.Strategy,
			CanaryPercent:  n.Deployment.CanaryPercent,
			CanaryActive:   n.Deployment.IsCanaryActive,
			BlueGreenGroup: "",
			ActiveGroup:    "blue",
		}
		dm.states[n.ID] = ds
	}
}

func (dm *DeploymentManager) GetState(nodeID string) *NodeDeploymentState {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.states[nodeID]
}

func (dm *DeploymentManager) ShiftCanary(nodeID string, percent float64) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	if s, ok := dm.states[nodeID]; ok && s.Strategy == StrategyCanary {
		if percent < 0 {
			percent = 0
		}
		if percent > 100 {
			percent = 100
		}
		s.CanaryPercent = percent
		s.CanaryActive = percent > 0
		s.CanaryFailed = false
	}
}

func (dm *DeploymentManager) Failover(nodeID, direction string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	if s, ok := dm.states[nodeID]; ok {
		switch s.Strategy {
		case StrategyCanary:
			if direction == "stable" {
				s.CanaryPercent = 0
				s.CanaryActive = false
				s.CanaryFailed = true
			} else if direction == "canary" {
				s.CanaryPercent = 100
				s.CanaryActive = true
				s.CanaryFailed = false
			}
		case StrategyBlueGreen:
			if direction == "blue" || direction == "green" {
				s.ActiveGroup = direction
			}
		}
	}
}

func (dm *DeploymentManager) SetGroup(nodeID, group string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	if s, ok := dm.states[nodeID]; ok {
		s.BlueGreenGroup = group
	}
}

func (dm *DeploymentManager) PromoteBlueGreen(nodeID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	if s, ok := dm.states[nodeID]; ok && s.Strategy == StrategyBlueGreen {
		if s.ActiveGroup == "blue" {
			s.ActiveGroup = "green"
		} else {
			s.ActiveGroup = "blue"
		}
	}
}

func (dm *DeploymentManager) IsActiveForBlueGreen(nodeID string) bool {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	s, ok := dm.states[nodeID]
	if !ok {
		return true
	}
	if s.Strategy != StrategyBlueGreen {
		return true
	}
	return s.BlueGreenGroup == "" || s.BlueGreenGroup == s.ActiveGroup
}

func (dm *DeploymentManager) ApplyCanarySplit(nodeID string, totalRPS float64, errorRate float64) (stableRPS float64, canaryRPS float64, failover bool) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	s, ok := dm.states[nodeID]
	if !ok || !s.CanaryActive || s.CanaryPercent <= 0 {
		return totalRPS, 0, false
	}

	canaryPct := s.CanaryPercent / 100.0

	// Auto-failover: if canary has high error rate, shift all back to stable
	if errorRate > 0.3 && canaryPct > 0 {
		s.CanaryFailed = true
		s.CanaryActive = false
		s.CanaryPercent = 0
		return totalRPS, 0, true
	}

	stableRPS = totalRPS * (1 - canaryPct)
	canaryRPS = totalRPS * canaryPct
	return stableRPS, canaryRPS, false
}

func (dm *DeploymentManager) AllStates() []*NodeDeploymentState {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	result := make([]*NodeDeploymentState, 0, len(dm.states))
	for _, s := range dm.states {
		result = append(result, s)
	}
	return result
}
