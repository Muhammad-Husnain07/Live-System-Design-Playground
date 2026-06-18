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

func TestMathRound(t *testing.T) {
	tests := []struct {
		v        float64
		decimals int
		want     float64
	}{
		{123.456789, 2, 123.46},
		{123.456789, 0, 123},
		{99.9999, 2, 100.00},
		{0.0001234, 4, 0.0001},
		{42, 2, 42},
	}
	for _, tt := range tests {
		got := mathRound(tt.v, tt.decimals)
		if got != tt.want {
			t.Errorf("mathRound(%v, %d) = %v, want %v", tt.v, tt.decimals, got, tt.want)
		}
	}
}

func TestGeoMetricsAggregation_RegionMetrics(t *testing.T) {
	regions := map[string]RegionMetrics{
		"us-east-1": {
			NodeCount:    3,
			TotalRPS:     1500.50,
			AvgLatencyMs: 45.20,
			AvgErrorRate: 0.0012,
			NodeIDs:      []string{"web-1", "app-1", "db-1"},
			IsFailed:     false,
			FailedNodeIDs: nil,
		},
		"eu-west-1": {
			NodeCount:    2,
			TotalRPS:     800.00,
			AvgLatencyMs: 120.75,
			AvgErrorRate: 0.05,
			NodeIDs:      []string{"web-eu", "db-eu"},
			IsFailed:     true,
			FailedNodeIDs: []string{"db-eu"},
		},
	}
	resp := GeoMetricsResponse{Regions: regions, InterRegionEdges: []InterRegionEdge{}}

	us := resp.Regions["us-east-1"]
	if us.TotalRPS != 1500.50 {
		t.Errorf("us-east-1 TotalRPS: expected 1500.50, got %v", us.TotalRPS)
	}
	if us.AvgLatencyMs != 45.20 {
		t.Errorf("us-east-1 AvgLatencyMs: expected 45.20, got %v", us.AvgLatencyMs)
	}
	if len(us.NodeIDs) != 3 {
		t.Errorf("us-east-1 NodeIDs: expected 3, got %d", len(us.NodeIDs))
	}
	if us.IsFailed {
		t.Error("us-east-1: expected IsFailed=false")
	}

	eu := resp.Regions["eu-west-1"]
	if !eu.IsFailed {
		t.Error("eu-west-1: expected IsFailed=true")
	}
	if len(eu.FailedNodeIDs) != 1 || eu.FailedNodeIDs[0] != "db-eu" {
		t.Errorf("eu-west-1 FailedNodeIDs: expected [db-eu], got %v", eu.FailedNodeIDs)
	}
}

func TestGeoMetricsAggregation_InterRegionEdge(t *testing.T) {
	edges := []InterRegionEdge{
		{SourceRegion: "us-east-1", TargetRegion: "eu-west-1", TotalRPS: 500, AvgLatencyMs: 95, EdgeCount: 3},
		{SourceRegion: "eu-west-1", TargetRegion: "ap-southeast-1", TotalRPS: 200, AvgLatencyMs: 175, EdgeCount: 2},
	}
	resp := GeoMetricsResponse{Regions: map[string]RegionMetrics{}, InterRegionEdges: edges}

	if len(resp.InterRegionEdges) != 2 {
		t.Fatalf("expected 2 edges, got %d", len(resp.InterRegionEdges))
	}
	e := resp.InterRegionEdges[0]
	if e.TotalRPS != 500 || e.AvgLatencyMs != 95 || e.EdgeCount != 3 {
		t.Errorf("edge 0: expected 500/95/3, got %v/%v/%d", e.TotalRPS, e.AvgLatencyMs, e.EdgeCount)
	}
	if e.SourceRegion != "us-east-1" || e.TargetRegion != "eu-west-1" {
		t.Errorf("edge 0 regions: expected us-east-1 -> eu-west-1, got %s -> %s", e.SourceRegion, e.TargetRegion)
	}
}

func TestGeoMetricsResponse_EmptyRegions(t *testing.T) {
	_ = GeoMetricsResponse{
		Regions:         map[string]RegionMetrics{},
		InterRegionEdges: []InterRegionEdge{},
	}
	// Should not panic
}
