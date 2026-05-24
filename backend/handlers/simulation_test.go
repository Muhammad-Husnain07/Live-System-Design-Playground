package handlers

import (
	"testing"

	"systemdesign/models"
)

func TestParseCanvasToSimNodes_FailedNode(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "db-1",
					"data": map[string]any{
						"nodeType": "PostgreSQLDB",
						"label":    "Primary DB",
						"config": map[string]any{
							"instances": 2,
							"maxRPS":    5000.0,
							"isFailed":  true,
						},
					},
				},
			},
			"edges": []any{},
		},
	}

	nodes, edges, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("parseCanvasToSimNodes failed: %v", err)
	}
	if len(nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(nodes))
	}
	if len(edges) != 0 {
		t.Errorf("expected 0 edges, got %d", len(edges))
	}
	if !nodes[0].IsFailed {
		t.Error("expected IsFailed=true when config has isFailed=true")
	}
	if nodes[0].Instances != 2 {
		t.Errorf("Instances = %d, want 2", nodes[0].Instances)
	}
	if nodes[0].MaxRPS != 5000 {
		t.Errorf("MaxRPS = %v, want 5000", nodes[0].MaxRPS)
	}
}

func TestParseCanvasToSimNodes_NotFailed(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "web-1",
					"data": map[string]any{
						"nodeType": "WebServer",
						"label":    "Web",
						"config": map[string]any{
							"instances": 3,
							"maxRPS":    4000.0,
							"isFailed":  false,
						},
					},
				},
			},
			"edges": []any{},
		},
	}

	nodes, _, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("parseCanvasToSimNodes failed: %v", err)
	}
	if nodes[0].IsFailed {
		t.Error("expected IsFailed=false when config has isFailed=false")
	}
}

func TestParseCanvasToSimNodes_NoIsFailed(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "web-1",
					"data": map[string]any{
						"nodeType": "WebServer",
						"label":    "Web",
						"config": map[string]any{
							"instances": 3,
							"maxRPS":    4000.0,
						},
					},
				},
			},
			"edges": []any{},
		},
	}

	nodes, _, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("parseCanvasToSimNodes failed: %v", err)
	}
	if nodes[0].IsFailed {
		t.Error("expected IsFailed=false when isFailed not in config")
	}
}

func TestParseCanvasToSimNodes_IgnoresIsBottleneck(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "cache-1",
					"data": map[string]any{
						"nodeType": "Redis",
						"label":    "Cache",
						"config": map[string]any{
							"instances":    2,
							"maxRPS":       10000.0,
							"isBottleneck": true,
						},
					},
				},
			},
			"edges": []any{},
		},
	}

	nodes, _, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("parseCanvasToSimNodes failed: %v", err)
	}
	// IsBottleneck is json:"-" on simulation.Node and NOT read from config
	// by parseCanvasToSimNodes, so it must be false
	if nodes[0].IsBottleneck {
		t.Error("expected IsBottleneck=false (isBottleneck is not read from config)")
	}
}

func TestParseCanvasToSimNodes_Defaults(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "n1",
					"data": map[string]any{
						"nodeType": "AppServer",
						"label":    "App",
						"config":   map[string]any{},
					},
				},
			},
			"edges": []any{},
		},
	}

	nodes, _, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(nodes))
	}
	if nodes[0].Instances != 1 {
		t.Errorf("Instances = %d, want 1 (default)", nodes[0].Instances)
	}
	if nodes[0].MaxRPS != 1000 {
		t.Errorf("MaxRPS = %v, want 1000 (default)", nodes[0].MaxRPS)
	}
}

func TestParseCanvasToSimNodes_WithEdges(t *testing.T) {
	proj := &models.ProjectDetailResponse{
		CanvasData: map[string]any{
			"nodes": []any{
				map[string]any{
					"id": "web-1",
					"data": map[string]any{
						"nodeType": "WebServer",
						"label":    "Web",
						"config":   map[string]any{"instances": 3, "maxRPS": 4000.0},
					},
				},
				map[string]any{
					"id": "db-1",
					"data": map[string]any{
						"nodeType": "PostgreSQLDB",
						"label":    "DB",
						"config":   map[string]any{"instances": 2, "maxRPS": 5000.0},
					},
				},
			},
			"edges": []any{
				map[string]any{
					"id":     "e1",
					"source": "web-1",
					"target": "db-1",
					"data": map[string]any{
						"routing": map[string]any{
							"trafficPercent": 100.0,
							"isSync":         true,
						},
					},
				},
			},
		},
	}

	nodes, edges, err := parseCanvasToSimNodes(proj)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(nodes))
	}
	if len(edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(edges))
	}
	if edges[0].TrafficPercent != 100 {
		t.Errorf("TrafficPercent = %v, want 100", edges[0].TrafficPercent)
	}
	if !edges[0].IsSync {
		t.Error("expected IsSync=true")
	}
}
