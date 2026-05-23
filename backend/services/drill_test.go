package services

import (
	"encoding/json"
	"testing"

	"systemdesign/simulation"
)

func TestPickDrillNodesAll(t *testing.T) {
	nodes := []simulation.Node{
		{ID: "web-1", NodeType: "WebServer"},
		{ID: "db-1", NodeType: "PostgreSQLDB"},
		{ID: "cache-1", NodeType: "Redis"},
	}
	ids := pickDrillNodes(nodes, "all")
	if len(ids) != 3 {
		t.Errorf("expected 3 ids, got %d: %v", len(ids), ids)
	}
}

func TestPickDrillNodesDatabase(t *testing.T) {
	nodes := []simulation.Node{
		{ID: "web-1", NodeType: "WebServer"},
		{ID: "db-1", NodeType: "PostgreSQLDB"},
		{ID: "mongo-1", NodeType: "MongoDB"},
		{ID: "cache-1", NodeType: "Redis"},
		{ID: "es-1", NodeType: "Elasticsearch"},
		{ID: "app-1", NodeType: "AppServer"},
	}
	ids := pickDrillNodes(nodes, "database")
	if len(ids) != 4 {
		t.Errorf("expected 4 database ids, got %d: %v", len(ids), ids)
	}
}

func TestPickDrillNodesDatabaseNoMatch(t *testing.T) {
	nodes := []simulation.Node{
		{ID: "web-1", NodeType: "WebServer"},
		{ID: "lb-1", NodeType: "LoadBalancer"},
	}
	ids := pickDrillNodes(nodes, "database")
	if len(ids) != 0 {
		t.Errorf("expected 0 database nodes, got %d", len(ids))
	}
}

func TestParseCanvasToSimulationNodes(t *testing.T) {
	canvas := json.RawMessage(`{
		"nodes": [
			{"id":"web-1","data":{"nodeType":"WebServer","label":"Web","config":{"instances":3,"maxRPS":4000,"latencyMs":20,"errorRate":0}}},
			{"id":"db-1","data":{"nodeType":"PostgreSQLDB","label":"DB","config":{"instances":2}}}
		],
		"edges": [
			{"id":"e1","source":"web-1","target":"db-1","data":{"routing":{"trafficPercent":100,"isSync":true}}}
		]
	}`)

	nodes, edges, err := parseCanvasToSimulationNodes(canvas)
	if err != nil {
		t.Fatalf("parseCanvasToSimulationNodes failed: %v", err)
	}

	if len(nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(nodes))
	}
	if len(edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(edges))
	}

	if nodes[0].Instances != 3 {
		t.Errorf("nodes[0].Instances = %d, want 3", nodes[0].Instances)
	}
	if nodes[1].MaxRPS != 1000 {
		t.Errorf("db default MaxRPS = %v, want 1000", nodes[1].MaxRPS)
	}
}

func TestParseCanvasToSimulationNodesDefaults(t *testing.T) {
	canvas := json.RawMessage(`{
		"nodes": [{"id":"n1","data":{"nodeType":"AppServer","label":"App","config":{}}}],
		"edges": []
	}`)
	nodes, _, err := parseCanvasToSimulationNodes(canvas)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(nodes))
	}
	if nodes[0].Instances != 1 {
		t.Errorf("Instances = %d, want 1", nodes[0].Instances)
	}
	if nodes[0].MaxRPS != 1000 {
		t.Errorf("MaxRPS = %v, want 1000", nodes[0].MaxRPS)
	}
}

func TestParseCanvasToSimulationNodesInvalidJSON(t *testing.T) {
	_, _, err := parseCanvasToSimulationNodes(json.RawMessage(`{invalid}`))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestDrillResultJSON(t *testing.T) {
	result := DrillResult{
		SimulationRunID: "run-1",
		Scenario:        "region_down",
		Passed:          true,
		MaxErrorRate:    0.05,
		InjectedAt:      100,
		DurationTicks:   500,
	}
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	var decoded DrillResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Scenario != "region_down" {
		t.Errorf("Scenario = %q, want region_down", decoded.Scenario)
	}
	if !decoded.Passed {
		t.Error("Passed should be true")
	}
}
