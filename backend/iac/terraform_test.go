package iac

import (
	"strings"
	"testing"
)

func TestGenerateTerraformBasicWebApp(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-test",
		ProjectName: "TestApp",
		Resources: []Resource{
			{ID: "lb", Type: "LoadBalancer", Provider: "aws", Properties: map[string]any{"instances": float64(2), "maxRPS": float64(50000)}},
			{ID: "web", Type: "WebServer", Provider: "aws", Properties: map[string]any{"instances": float64(3), "maxRPS": float64(4000)}},
			{ID: "db", Type: "PostgreSQLDB", Provider: "aws", Properties: map[string]any{"instances": float64(2), "maxRPS": float64(10000)}},
		},
		Edges: []Edge{
			{Source: "lb", Target: "web"},
			{Source: "web", Target: "db"},
		},
	}
	hcl, err := GenerateTerraform(data)
	if err != nil {
		t.Fatalf("GenerateTerraform failed: %v", err)
	}
	if hcl == "" {
		t.Fatal("expected non-empty HCL output")
	}
	if !strings.Contains(hcl, "required_providers") {
		t.Error("expected required_providers block in HCL")
	}
	if !strings.Contains(hcl, "aws") {
		t.Error("expected AWS provider declaration")
	}
	if !strings.Contains(hcl, "LoadBalancer") {
		t.Error("expected LoadBalancer resource block")
	}
	if !strings.Contains(hcl, "WebServer") {
		t.Error("expected WebServer resource block")
	}
	if !strings.Contains(hcl, "PostgreSQLDB") {
		t.Error("expected PostgreSQLDB resource block")
	}
}

func TestGenerateTerraformJSONRoundTrip(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-json",
		ProjectName: "JSONTest",
		Resources: []Resource{
			{ID: "redis", Type: "Redis", Provider: "aws", Properties: map[string]any{"instances": float64(1), "maxRPS": float64(50000)}},
		},
		Edges: []Edge{},
	}
	jsonOut, err := GenerateTerraformJSON(data)
	if err != nil {
		t.Fatalf("GenerateTerraformJSON failed: %v", err)
	}
	if jsonOut == "" {
		t.Fatal("expected non-empty JSON output")
	}
	if !strings.Contains(jsonOut, "Redis") {
		t.Error("expected Redis resource in JSON output")
	}
}

func TestGenerateTerraformEmptyData(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-empty",
		ProjectName: "Empty",
		Resources:   []Resource{},
		Edges:       []Edge{},
	}
	hcl, err := GenerateTerraform(data)
	if err != nil {
		t.Fatalf("GenerateTerraform failed: %v", err)
	}
	if hcl == "" {
		t.Fatal("expected non-empty HCL even for empty resources")
	}
	if !strings.Contains(hcl, "required_providers") {
		t.Error("expected required_providers even for empty project")
	}
}

func TestGenerateTerraformSanitizedID(t *testing.T) {
	if got := SanitizeID("my-resource-1"); got != "resource_my_resource_1" {
		t.Errorf("SanitizeID('my-resource-1') = %q, want 'resource_my_resource_1'", got)
	}
	if got := SanitizeID("simple"); got != "resource_simple" {
		t.Errorf("SanitizeID('simple') = %q, want 'resource_simple'", got)
	}
}

func TestGenerateTerraformModernTypes(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-modern",
		ProjectName: "ModernWorkloads",
		Resources: []Resource{
			{ID: "llm", Type: "LLMNode", Provider: "aws", Properties: map[string]any{"instance_type": "ml.g5.2xlarge"}},
			{ID: "gpu", Type: "GPUCluster", Provider: "aws", Properties: map[string]any{"instance_type": "p3.2xlarge"}},
			{ID: "edge", Type: "EdgeCompute", Provider: "aws", Properties: map[string]any{"runtime": "cloudfront-js-2.0"}},
			{ID: "sv2", Type: "ServerlessV2", Provider: "aws", Properties: map[string]any{"snap_start": true}},
		},
	}
	hcl, err := GenerateTerraform(data)
	if err != nil {
		t.Fatalf("GenerateTerraform failed: %v", err)
	}
	for _, s := range []string{"LLMNode", "GPUCluster", "EdgeCompute", "ServerlessV2"} {
		if !strings.Contains(hcl, s) {
			t.Errorf("expected %q in HCL output", s)
		}
	}
}
