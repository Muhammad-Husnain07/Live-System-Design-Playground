package services

import (
	"encoding/json"
	"testing"
)

// TestCanvasJSONB_RoundTrip verifies that canvas_data serializes and
// deserializes correctly, preserving nodes, edges, and viewport.
func TestCanvasJSONB_RoundTrip(t *testing.T) {
	input := map[string]any{
		"nodes": []any{
			map[string]any{
				"id":   "lb-1",
				"type": "loadBalancer",
				"position": map[string]any{
					"x": 250.0,
					"y": 50.0,
				},
				"data": map[string]any{
					"nodeType": "LoadBalancer",
					"label":    "Main LB",
					"config": map[string]any{
						"instances": 2,
						"maxRPS":    10000.0,
						"region":    "us-east-1",
					},
				},
			},
			map[string]any{
				"id":   "app-1",
				"type": "default",
				"position": map[string]any{
					"x": 550.0,
					"y": 50.0,
				},
				"data": map[string]any{
					"nodeType": "AppServer",
					"label":    "App Server",
					"config": map[string]any{
						"instances": 3,
						"maxRPS":    2000.0,
						"region":    "us-east-1",
					},
				},
			},
		},
		"edges": []any{
			map[string]any{
				"id":     "lb-1->app-1",
				"source": "lb-1",
				"target": "app-1",
				"data": map[string]any{
					"routing": map[string]any{
						"protocol":       "HTTP",
						"isSync":         true,
						"trafficPercent": 100.0,
						"requiresTLS":    true,
					},
					"throughputRPS": 0,
					"latencyMs":     0,
				},
			},
		},
		"viewport": map[string]any{
			"x":    0.0,
			"y":    0.0,
			"zoom": 1.0,
		},
	}

	// Simulate JSONB serialization (like backend stores it)
	serialized, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	if !json.Valid(serialized) {
		t.Fatal("serialized output is not valid JSON")
	}

	// Simulate JSONB deserialization (like backend reads it)
	var output map[string]any
	if err := json.Unmarshal(serialized, &output); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	// Verify structure preservation
	nodes, ok := output["nodes"].([]any)
	if !ok {
		t.Fatal("nodes should be an array")
	}
	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}

	edges, ok := output["edges"].([]any)
	if !ok {
		t.Fatal("edges should be an array")
	}
	if len(edges) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(edges))
	}

	viewport, ok := output["viewport"].(map[string]any)
	if !ok {
		t.Fatal("viewport should exist in round-trip output")
	}
	if viewport["x"] != 0.0 || viewport["y"] != 0.0 || viewport["zoom"] != 1.0 {
		t.Errorf("viewport values changed: got %v", viewport)
	}

	// Verify specific node fields
	firstNode := nodes[0].(map[string]any)
	if firstNode["id"] != "lb-1" {
		t.Errorf("expected node id 'lb-1', got %v", firstNode["id"])
	}
	pos := firstNode["position"].(map[string]any)
	if pos["x"] != 250.0 || pos["y"] != 50.0 {
		t.Errorf("position changed: got %v", pos)
	}

	// Verify specific edge fields
	firstEdge := edges[0].(map[string]any)
	if firstEdge["source"] != "lb-1" {
		t.Errorf("expected source 'lb-1', got %v", firstEdge["source"])
	}
}

func TestCanvasJSONB_EmptyCanvas(t *testing.T) {
	input := map[string]any{
		"nodes":    []any{},
		"edges":    []any{},
		"viewport": map[string]any{"x": 0, "y": 0, "zoom": 1},
	}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var output map[string]any
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	nodes := output["nodes"].([]any)
	if len(nodes) != 0 {
		t.Errorf("expected 0 nodes, got %d", len(nodes))
	}
}

func TestCanvasJSONB_NodeConfigPreservation(t *testing.T) {
	input := map[string]any{
		"nodes": []any{
			map[string]any{
				"id": "db-1",
				"data": map[string]any{
					"nodeType": "PostgreSQLDB",
					"config": map[string]any{
						"instances":           2,
						"maxRPS":              5000.0,
						"latencyMs":           50.0,
						"errorRate":           0.001,
						"region":              "eu-west-1",
						"isFailed":            false,
						"isBottleneck":        false,
						"isPrimaryDB":         true,
						"replicationRole":     "primary",
						"replicationLagMs":    5.0,
						"connectionPoolMax":   100.0,
						"diskIOPSMax":         10000.0,
						"cacheHitRatio":       0.95,
						"computeTier":         "reserved",
						"tokensPerSecond":     0,
						"promptTokenCount":    0,
						"completionTokenCount": 0,
						"vramGB":              0,
						"modelSizeGB":         0,
						"cudaUtilization":     0,
						"geographicLatencyModifier": 1.0,
						"deployment": map[string]any{
							"strategy":        "rolling",
							"canaryPercent":   10.0,
							"canaryVersion":   "",
							"isCanaryActive":  false,
						},
						"security": map[string]any{
							"isPublicFacing":  false,
							"requiresTLS":     true,
							"allowedInbound":  []any{},
							"vpcId":          "vpc-main",
						},
						"autoScaling": map[string]any{
							"enabled":         false,
							"minInstances":    1,
							"maxInstances":    5,
							"targetCPUPercent": 80.0,
							"targetMemPercent": 80.0,
							"cooldownTicks":   60.0,
							"scaleUpFactor":   2.0,
							"scaleDownFactor": 0.5,
						},
					},
				},
			},
		},
		"edges": []any{},
	}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var output map[string]any
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	nodes := output["nodes"].([]any)
	dbNode := nodes[0].(map[string]any)
	dbData := dbNode["data"].(map[string]any)
	config := dbData["config"].(map[string]any)

	if config["instances"] != 2.0 {
		t.Errorf("instances: got %v, want 2", config["instances"])
	}
	if config["replicationRole"] != "primary" {
		t.Errorf("replicationRole: got %v, want 'primary'", config["replicationRole"])
	}
	if config["region"] != "eu-west-1" {
		t.Errorf("region: got %v, want 'eu-west-1'", config["region"])
	}

	dep := config["deployment"].(map[string]any)
	if dep["strategy"] != "rolling" {
		t.Errorf("deployment.strategy: got %v", dep["strategy"])
	}

	sec := config["security"].(map[string]any)
	if sec["vpcId"] != "vpc-main" {
		t.Errorf("security.vpcId: got %v", sec["vpcId"])
	}
}

func TestCanvasJSONB_LoadBalancerNode(t *testing.T) {
	input := map[string]any{
		"nodes": []any{
			map[string]any{
				"id":   "lb-1",
				"type": "loadBalancer",
				"data": map[string]any{
					"nodeType": "LoadBalancer",
					"label":    "ALB",
					"config": map[string]any{
						"instances": 2,
						"maxRPS":    10000.0,
					},
				},
			},
		},
		"edges": []any{},
	}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var output map[string]any
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	nodes := output["nodes"].([]any)
	lb := nodes[0].(map[string]any)
	if lb["type"] != "loadBalancer" {
		t.Errorf("expected type 'loadBalancer', got %v", lb["type"])
	}
}

func TestCanvasJSONB_EdgeRoutingData(t *testing.T) {
	input := map[string]any{
		"nodes": []any{
			map[string]any{
				"id": "src", "type": "default",
				"data": map[string]any{"nodeType": "WebServer", "label": "Src"},
			},
			map[string]any{
				"id": "dst", "type": "database",
				"data": map[string]any{"nodeType": "PostgreSQLDB", "label": "Dst"},
			},
		},
		"edges": []any{
			map[string]any{
				"id": "e1", "source": "src", "target": "dst", "type": "smoothstep",
				"data": map[string]any{
					"routing": map[string]any{
						"protocol":       "HTTP",
						"isSync":         true,
						"trafficPercent": 80.0,
						"requiresTLS":    true,
						"authRequired":   false,
					},
					"throughputRPS": 4500,
					"latencyMs":     12,
					"isAnimated":    true,
					"isSaturated":   false,
					"isSecure":      true,
				},
			},
		},
	}

	data, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var output map[string]any
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	edges := output["edges"].([]any)
	e := edges[0].(map[string]any)
	eData := e["data"].(map[string]any)

	if e["type"] != "smoothstep" {
		t.Errorf("expected type 'smoothstep', got %v", e["type"])
	}
	if eData["throughputRPS"] != 4500.0 {
		t.Errorf("throughputRPS: got %v, want 4500", eData["throughputRPS"])
	}
	if eData["latencyMs"] != 12.0 {
		t.Errorf("latencyMs: got %v, want 12", eData["latencyMs"])
	}
	if eData["isSecure"] != true {
		t.Errorf("isSecure: got %v, want true", eData["isSecure"])
	}
}

func TestCanvasJSONB_ViewportPersistence(t *testing.T) {
	// Simulate a zoomed/panned viewport
	viewportStates := []map[string]any{
		{"x": 100.0, "y": -200.0, "zoom": 1.5},
		{"x": -500.0, "y": 300.0, "zoom": 0.75},
		{"x": 0.0, "y": 0.0, "zoom": 2.0},
		{"x": 250.0, "y": 150.0, "zoom": 1.0},
	}

	for _, vp := range viewportStates {
		canvas := map[string]any{
			"nodes":    []any{},
			"edges":    []any{},
			"viewport": vp,
		}
		data, err := json.Marshal(canvas)
		if err != nil {
			t.Fatalf("marshal failed for viewport %v: %v", vp, err)
		}

		var output map[string]any
		if err := json.Unmarshal(data, &output); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}

		outVP := output["viewport"].(map[string]any)
		if outVP["x"] != vp["x"] || outVP["y"] != vp["y"] || outVP["zoom"] != vp["zoom"] {
			t.Errorf("viewport changed: input %v, output %v", vp, outVP)
		}
	}
}
