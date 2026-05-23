package services

import (
	"encoding/json"
	"fmt"
	"time"

	"systemdesign/simulation"

	"github.com/google/uuid"
)

const (
	DrillScenarioRegionDown = "region_down"
	DrillScenarioDDoS       = "ddos"
	DrillScenarioDBFailure  = "db_failure"
)

type DrillResult struct {
	SimulationRunID string  `json:"simulationRunId"`
	Scenario        string  `json:"scenario"`
	Passed          bool    `json:"passed"`
	MaxErrorRate    float64 `json:"maxErrorRate"`
	InjectedAt      int     `json:"injectedAt"`
	DurationTicks   int     `json:"durationTicks"`
}

type DrillScenarioConfig struct {
	ChaosType       simulation.ChaosEventType
	NodeFilter      string // "all", "database", "compute"
	Severity        float64
	DurationTicks   int
	InjectAfterMin  int // seconds
	InjectAfterMax  int
	MonitorDuration int // ticks after injection to monitor
}

var drillScenarios = map[string]DrillScenarioConfig{
	DrillScenarioRegionDown: {
		ChaosType:       simulation.ChaosRegionDown,
		NodeFilter:      "all",
		Severity:        0.8,
		DurationTicks:   600,
		InjectAfterMin:  5,
		InjectAfterMax:  15,
		MonitorDuration: 300,
	},
	DrillScenarioDDoS: {
		ChaosType:       simulation.ChaosDDoS,
		NodeFilter:      "all",
		Severity:        0.7,
		DurationTicks:   400,
		InjectAfterMin:  5,
		InjectAfterMax:  12,
		MonitorDuration: 300,
	},
	DrillScenarioDBFailure: {
		ChaosType:       simulation.ChaosNodeFailure,
		NodeFilter:      "database",
		Severity:        0.9,
		DurationTicks:   500,
		InjectAfterMin:  5,
		InjectAfterMax:  15,
		MonitorDuration: 300,
	},
}

func pickDrillNodes(nodes []simulation.Node, filter string) []string {
	if filter == "all" {
		ids := make([]string, 0, len(nodes))
		for _, n := range nodes {
			ids = append(ids, n.ID)
		}
		return ids
	}
	dbTypes := map[string]bool{
		"PostgreSQLDB": true, "MySQLDB": true, "MongoDB": true,
		"Redis": true, "Elasticsearch": true,
	}
	ids := make([]string, 0)
	for _, n := range nodes {
		if filter == "database" && dbTypes[string(n.NodeType)] {
			ids = append(ids, n.ID)
		}
	}
	return ids
}

func RunDrill(canvasData json.RawMessage, projectID, scenario string) (*DrillResult, error) {
	scenarioCfg, ok := drillScenarios[scenario]
	if !ok {
		return nil, fmt.Errorf("unknown scenario: %s", scenario)
	}

	var canvas struct {
		Nodes []struct {
			ID   string `json:"id"`
			Data struct {
				NodeType string         `json:"nodeType"`
				Label    string         `json:"label"`
				Config   map[string]any `json:"config"`
			} `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			ID     string `json:"id"`
			Source string `json:"source"`
			Target string `json:"target"`
			Data   struct {
				Routing map[string]any `json:"routing"`
			} `json:"data"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(canvasData, &canvas); err != nil {
		return nil, fmt.Errorf("failed to parse canvas: %w", err)
	}

	simNodes := make([]simulation.Node, 0)
	for _, n := range canvas.Nodes {
		if n.Data.NodeType == "ExternalClient" || n.Data.NodeType == "ThirdPartyAPI" ||
			n.Data.NodeType == "MobileClient" || n.Data.NodeType == "WebBrowser" {
			continue
		}
		node := simulation.Node{
			ID:       n.ID,
			NodeType: simulation.NodeType(n.Data.NodeType),
			Label:    n.Data.Label,
		}
		if v, ok := n.Data.Config["instances"].(float64); ok {
			node.Instances = int(v)
		}
		if v, ok := n.Data.Config["maxRPS"].(float64); ok {
			node.MaxRPS = v
		}
		if v, ok := n.Data.Config["latencyMs"].(float64); ok {
			node.LatencyMs = v
		}
		if v, ok := n.Data.Config["errorRate"].(float64); ok {
			node.ErrorRate = v
		}
		if node.MaxRPS <= 0 {
			node.MaxRPS = 1000
		}
		if node.Instances <= 0 {
			node.Instances = 1
		}
		simNodes = append(simNodes, node)
	}

	if len(simNodes) == 0 {
		return nil, fmt.Errorf("no nodes found in canvas")
	}

	simEdges := make([]simulation.Edge, 0)
	for _, e := range canvas.Edges {
		edge := simulation.Edge{ID: e.ID, Source: e.Source, Target: e.Target, TrafficPercent: 100}
		if e.Data.Routing != nil {
			if p, ok := e.Data.Routing["trafficPercent"].(float64); ok {
				edge.TrafficPercent = p
			}
			if s, ok := e.Data.Routing["isSync"].(bool); ok {
				edge.IsSync = s
			}
		}
		simEdges = append(simEdges, edge)
	}

	chaosMgr := simulation.NewChaosManager()

	cfg := &simulation.Config{
		ProjectID:       projectID,
		Nodes:           simNodes,
		Edges:           simEdges,
		TargetRPS:       3000,
		DurationSeconds: 60,
		SpeedMultiplier: 5,
		Pattern:         simulation.TrafficSteady,
		TickRateMs:      100,
	}

	engine := simulation.NewEngine(cfg)
	runID := uuid.New().String()
	engine.RunID = runID
	engine.SetChaosManager(chaosMgr)

	var maxErrorRate float64
	var injectedAt int
	var monitoring bool
	monitorEndTick := 0

	engine.OnTick(func(tick simulation.Tick, tickNum int) {
		if tick.GlobalErrorRate > maxErrorRate {
			maxErrorRate = tick.GlobalErrorRate
		}

		if monitoring && tickNum >= monitorEndTick {
			engine.Stop()
		}
	})

	engine.Start()

	time.Sleep(100 * time.Millisecond)

	delay := randRange(scenarioCfg.InjectAfterMin, scenarioCfg.InjectAfterMax)
	for j := 0; j < delay; j++ {
		time.Sleep(100 * time.Millisecond)
		if !engine.IsRunning() {
			break
		}
	}

	if !engine.IsRunning() {
		return &DrillResult{
			SimulationRunID: runID,
			Scenario:        scenario,
			Passed:          false,
			MaxErrorRate:    maxErrorRate,
			InjectedAt:      engine.CurrentTick(),
			DurationTicks:   engine.CurrentTick(),
		}, nil
	}

	injectedAt = engine.CurrentTick()
	targetNodeIDs := pickDrillNodes(simNodes, scenarioCfg.NodeFilter)

	if len(targetNodeIDs) == 0 {
		targetNodeIDs = pickDrillNodes(simNodes, "all")
	}

	for _, nodeID := range targetNodeIDs {
		event := &simulation.ChaosEvent{
			ID:              uuid.New().String(),
			SimulationRunID: runID,
			NodeID:          nodeID,
			EventType:       scenarioCfg.ChaosType,
			Severity:        scenarioCfg.Severity,
			DurationTicks:   scenarioCfg.DurationTicks,
			StartedAt:       injectedAt,
			Active:          true,
		}
		chaosMgr.Inject(event)
	}

	monitoring = true
	monitorEndTick = injectedAt + scenarioCfg.MonitorDuration

	for engine.IsRunning() {
		time.Sleep(50 * time.Millisecond)
	}

	passed := maxErrorRate < 0.10

	return &DrillResult{
		SimulationRunID: runID,
		Scenario:        scenario,
		Passed:          passed,
		MaxErrorRate:    maxErrorRate,
		InjectedAt:      injectedAt,
		DurationTicks:   engine.CurrentTick(),
	}, nil
}

func parseCanvasToSimulationNodes(canvasData json.RawMessage) ([]simulation.Node, []simulation.Edge, error) {
	var canvas struct {
		Nodes []struct {
			ID   string `json:"id"`
			Data struct {
				NodeType string         `json:"nodeType"`
				Label    string         `json:"label"`
				Config   map[string]any `json:"config"`
			} `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			ID     string `json:"id"`
			Source string `json:"source"`
			Target string `json:"target"`
			Data   struct {
				Routing map[string]any `json:"routing"`
			} `json:"data"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(canvasData, &canvas); err != nil {
		return nil, nil, err
	}

	nodes := make([]simulation.Node, 0, len(canvas.Nodes))
	for _, n := range canvas.Nodes {
		node := simulation.Node{
			ID: n.ID, NodeType: simulation.NodeType(n.Data.NodeType), Label: n.Data.Label,
		}
		if v, ok := n.Data.Config["instances"].(float64); ok {
			node.Instances = int(v)
		}
		if v, ok := n.Data.Config["maxRPS"].(float64); ok {
			node.MaxRPS = v
		}
		if v, ok := n.Data.Config["latencyMs"].(float64); ok {
			node.LatencyMs = v
		}
		if v, ok := n.Data.Config["errorRate"].(float64); ok {
			node.ErrorRate = v
		}
		if node.MaxRPS <= 0 {
			node.MaxRPS = 1000
		}
		if node.Instances <= 0 {
			node.Instances = 1
		}
		nodes = append(nodes, node)
	}

	edges := make([]simulation.Edge, 0, len(canvas.Edges))
	for _, e := range canvas.Edges {
		edge := simulation.Edge{ID: e.ID, Source: e.Source, Target: e.Target, TrafficPercent: 100}
		if e.Data.Routing != nil {
			if p, ok := e.Data.Routing["trafficPercent"].(float64); ok {
				edge.TrafficPercent = p
			}
			if s, ok := e.Data.Routing["isSync"].(bool); ok {
				edge.IsSync = s
			}
		}
		edges = append(edges, edge)
	}

	return nodes, edges, nil
}
