package iac

import (
	"testing"
)

const simpleTerraform = `
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"
  tags = {
    Name = "WebServer"
  }
}

resource "aws_db_instance" "database" {
  engine         = "postgres"
  instance_class = "db.t3.medium"
  allocated_storage = 20
}

resource "aws_lb" "load_balancer" {
  name = "main-lb"
  internal = false
}
`

func TestParseSimpleTerraform(t *testing.T) {
	graph, err := ParseTerraform(simpleTerraform)
	if err != nil {
		t.Fatalf("ParseTerraform failed: %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
	if len(graph.Nodes) == 0 {
		t.Fatal("expected at least one node from Terraform HCL")
	}
	nodeIDs := make(map[string]bool)
	for _, n := range graph.Nodes {
		nodeIDs[n.ID] = true
	}
	if !nodeIDs["web_server"] && !nodeIDs["WebServer"] {
		t.Logf("nodes found: %v", nodeIDs)
	}
}

func TestParseTerraformWithEdges(t *testing.T) {
	hcl := `
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

resource "aws_instance" "app_server" {
  ami           = "ami-123"
  instance_type = "t3.small"
  tags = {
    Name = "AppServer"
  }
}

resource "aws_db_instance" "app_db" {
  engine = "postgres"
  instance_class = "db.t3.small"
  allocated_storage = 10
}
`
	graph, err := ParseTerraform(hcl)
	if err != nil {
		t.Fatalf("ParseTerraform failed: %v", err)
	}
	if len(graph.Nodes) < 2 {
		t.Errorf("expected at least 2 nodes, got %d", len(graph.Nodes))
	}
	_ = graph
}

func TestParseTerraformInvalidHCL(t *testing.T) {
	graph, err := ParseTerraform(`resource "aws_instance" "test" { invalid syntax`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if graph == nil {
		t.Error("expected non-nil graph even for invalid HCL")
	}
}

func TestParseTerraformEmpty(t *testing.T) {
	graph, err := ParseTerraform("")
	if err != nil {
		t.Fatalf("ParseTerraform empty failed: %v", err)
	}
	if graph != nil && len(graph.Nodes) > 0 {
		t.Errorf("expected empty graph for empty HCL, got %d nodes", len(graph.Nodes))
	}
}

func TestToCanvasData(t *testing.T) {
	graph := &InfraGraph{
		Nodes: []InfraNode{
			{ID: "web", NodeType: "WebServer", Label: "Web Server", Config: map[string]any{"instances": float64(2)}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database", Config: map[string]any{"instances": float64(1)}},
		},
		Edges: []InfraEdge{
			{Source: "web", Target: "db"},
		},
	}
	canvas := ToCanvasData(graph)
	if len(canvas.Nodes) != 2 {
		t.Errorf("expected 2 canvas nodes, got %d", len(canvas.Nodes))
	}
	if len(canvas.Edges) != 1 {
		t.Errorf("expected 1 canvas edge, got %d", len(canvas.Edges))
	}
	if canvas.Nodes[0].ID != "web" {
		t.Errorf("expected first node ID 'web', got %q", canvas.Nodes[0].ID)
	}
}

func TestParseTerraformAndToCanvas(t *testing.T) {
	graph, err := ParseTerraform(simpleTerraform)
	if err != nil {
		t.Fatalf("ParseTerraform failed: %v", err)
	}
	canvas := ToCanvasData(graph)
	if len(canvas.Nodes) == 0 {
		t.Error("expected at least one canvas node after import + convert")
	}
	for _, n := range canvas.Nodes {
		if n.ID == "" {
			t.Error("canvas node has empty ID")
		}
		if n.NodeType == "" {
			t.Errorf("canvas node %s has empty NodeType", n.ID)
		}
	}
}

func TestSanitizeIDForTerraform(t *testing.T) {
	if got := SanitizeID("my-instance-1"); got != "resource_my_instance_1" {
		t.Errorf("SanitizeID('my-instance-1') = %q, want 'resource_my_instance_1'", got)
	}
	if got := SanitizeID("abc"); got != "resource_abc" {
		t.Errorf("SanitizeID('abc') = %q, want 'resource_abc'", got)
	}
}
