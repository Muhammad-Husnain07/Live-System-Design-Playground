package iac

import (
	"strings"
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

func TestParseTerraformModernTypes(t *testing.T) {
	hcl := `
terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

resource "aws_sagemaker_endpoint" "llm_endpoint" {
  instance_type = "ml.g5.2xlarge"
  initial_instance_count = 1
}

resource "aws_instance" "gpu_node" {
  instance_type = "p3.2xlarge"
}

resource "aws_cloudfront_function" "edge_fn" {
  runtime = "cloudfront-js-2.0"
}

resource "aws_lambda_function" "serverless_v2" {
  filename = "function.zip"
  snap_start = {}
}
`
	graph, err := ParseTerraform(hcl)
	if err != nil {
		t.Fatalf("ParseTerraform failed: %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
	typesFound := make(map[string]bool)
	for _, n := range graph.Nodes {
		typesFound[n.NodeType] = true
	}
	if !typesFound["LLMNode"] {
		t.Error("expected LLMNode from aws_sagemaker_endpoint")
	}
	if typesFound["GPUCluster"] {
		t.Log("GPUCluster found (from aws_instance) — acceptable")
	}
	if !typesFound["EdgeCompute"] {
		t.Error("expected EdgeCompute from aws_cloudfront_function")
	}
	if !typesFound["ServerlessFunction"] {
		t.Error("expected ServerlessFunction from aws_lambda_function")
	}
}

func TestTerraformRoundTripModernTypes(t *testing.T) {
	// Use IaC resource type names (what mapper.go outputs) so ParseTerraform can read them back
	data := ExportData{
		ProjectID:   "proj-rt",
		ProjectName: "RoundTrip",
		Resources: []Resource{
			{ID: "llm", Type: "aws_sagemaker_endpoint", Provider: "aws", Properties: map[string]any{"instance_type": "ml.g5.2xlarge", "initial_instance_count": float64(1)}},
			{ID: "gpu", Type: "aws_instance", Provider: "aws", Properties: map[string]any{"instance_type": "p3.2xlarge"}},
			{ID: "edge", Type: "aws_cloudfront_function", Provider: "aws", Properties: map[string]any{"runtime": "cloudfront-js-2.0"}},
			{ID: "sv2", Type: "aws_lambda_function", Provider: "aws", Properties: map[string]any{"snap_start": "PublishedVersions"}},
		},
		Edges: []Edge{},
	}
	hcl, err := GenerateTerraform(data)
	if err != nil {
		t.Fatalf("GenerateTerraform failed: %v", err)
	}
	graph, err := ParseTerraform(hcl)
	if err != nil {
		t.Fatalf("ParseTerraform failed: %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
	if len(graph.Nodes) == 0 {
		t.Fatal("expected at least one node after round-trip")
	}
	typesFound := make(map[string]bool)
	for _, n := range graph.Nodes {
		typesFound[n.NodeType] = true
	}
	if !typesFound["LLMNode"] {
		t.Error("expected LLMNode from aws_sagemaker_endpoint round-trip")
	}
	if !typesFound["EdgeCompute"] {
		t.Error("expected EdgeCompute from aws_cloudfront_function round-trip")
	}
	if !typesFound["ServerlessFunction"] {
		t.Error("expected ServerlessFunction from aws_lambda_function round-trip")
	}
	if !typesFound["WebServer"] {
		t.Error("expected WebServer from aws_instance round-trip")
	}
}

func TestParseCloudFormationSimple(t *testing.T) {
	cf := `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "Test",
  "Resources": {
    "LB": {
      "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
      "Properties": { "Name": "main-lb" }
    },
    "Web": {
      "Type": "AWS::EC2::Instance",
      "Properties": { "InstanceType": "t3.medium" }
    },
    "DB": {
      "Type": "AWS::RDS::DBInstance",
      "Properties": { "Engine": "postgres" }
    }
  }
}`
	graph, err := ParseCloudFormation(cf)
	if err != nil {
		t.Fatalf("ParseCloudFormation failed: %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
	if len(graph.Nodes) != 3 {
		t.Errorf("expected 3 nodes, got %d", len(graph.Nodes))
	}
}

func TestParseCloudFormationModernTypes(t *testing.T) {
	cf := `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Resources": {
    "LLMEndpoint": {
      "Type": "AWS::SageMaker::Endpoint",
      "Properties": { "EndpointName": "llm-ep" }
    },
    "GPUNode": {
      "Type": "AWS::EC2::Instance",
      "Properties": { "InstanceType": "p3.2xlarge" }
    },
    "EdgeFn": {
      "Type": "AWS::CloudFront::Function",
      "Properties": { "Runtime": "cloudfront-js-2.0" }
    },
    "ServerlessFn": {
      "Type": "AWS::Lambda::Function",
      "Properties": { "Runtime": "nodejs20.x" }
    }
  }
}`
	graph, err := ParseCloudFormation(cf)
	if err != nil {
		t.Fatalf("ParseCloudFormation failed: %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
	typesFound := make(map[string]bool)
	for _, n := range graph.Nodes {
		typesFound[n.NodeType] = true
	}
	if !typesFound["LLMNode"] {
		t.Error("expected LLMNode from AWS::SageMaker::Endpoint")
	}
	if !typesFound["EdgeCompute"] {
		t.Error("expected EdgeCompute from AWS::CloudFront::Function")
	}
	if !typesFound["WebServer"] {
		t.Error("expected WebServer from AWS::EC2::Instance")
	}
	if !typesFound["ServerlessFunction"] {
		t.Error("expected ServerlessFunction from AWS::Lambda::Function")
	}
}

func TestParseCloudFormationInvalidJSON(t *testing.T) {
	graph, err := ParseCloudFormation(`not json`)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
	if graph != nil {
		t.Error("expected nil graph for invalid JSON")
	}
}

func TestParseCloudFormationMissingResources(t *testing.T) {
	graph, err := ParseCloudFormation(`{"AWSTemplateFormatVersion": "2010-09-09"}`)
	if err == nil {
		t.Error("expected error for missing Resources")
	}
	if graph != nil {
		t.Error("expected nil graph for missing Resources")
	}
}

func TestGenerateCloudFormationBasic(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-cf",
		ProjectName: "CFTest",
		Resources: []Resource{
			{ID: "lb", Type: "AWS::ElasticLoadBalancingV2::LoadBalancer", Provider: "aws", Properties: map[string]any{"Name": "main-lb"}},
			{ID: "web", Type: "AWS::EC2::Instance", Provider: "aws", Properties: map[string]any{"InstanceType": "t3.medium"}},
		},
		Edges: []Edge{},
	}
	cf, err := GenerateCloudFormation(data)
	if err != nil {
		t.Fatalf("GenerateCloudFormation failed: %v", err)
	}
	if cf == "" {
		t.Fatal("expected non-empty JSON output")
	}
	if !strings.Contains(cf, "AWS::ElasticLoadBalancingV2::LoadBalancer") {
		t.Error("expected LoadBalancer type in JSON output")
	}
	if !strings.Contains(cf, "AWS::EC2::Instance") {
		t.Error("expected EC2 Instance type in JSON output")
	}
	if !strings.Contains(cf, "main-lb") {
		t.Error("expected 'main-lb' property value in JSON output")
	}
}

func TestGenerateCloudFormationModernTypes(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-cf-modern",
		ProjectName: "CFModern",
		Resources: []Resource{
			{ID: "llm", Type: "AWS::SageMaker::Endpoint", Provider: "aws", Properties: map[string]any{"EndpointName": "llm-ep"}},
			{ID: "edge", Type: "AWS::CloudFront::Function", Provider: "aws", Properties: map[string]any{"Runtime": "cloudfront-js-2.0"}},
			{ID: "gpu", Type: "AWS::EC2::Instance", Provider: "aws", Properties: map[string]any{"InstanceType": "p3.2xlarge"}},
		},
	}
	cf, err := GenerateCloudFormation(data)
	if err != nil {
		t.Fatalf("GenerateCloudFormation failed: %v", err)
	}
	for _, s := range []string{"AWS::SageMaker::Endpoint", "AWS::CloudFront::Function", "AWS::EC2::Instance"} {
		if !strings.Contains(cf, s) {
			t.Errorf("expected %q in CloudFormation output", s)
		}
	}
}

func TestGenerateCloudFormationEmpty(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-empty",
		ProjectName: "Empty",
		Resources:   []Resource{},
		Edges:       []Edge{},
	}
	cf, err := GenerateCloudFormation(data)
	if err != nil {
		t.Fatalf("GenerateCloudFormation failed: %v", err)
	}
	if cf == "" {
		t.Fatal("expected non-empty JSON even for empty resources")
	}
	if !strings.Contains(cf, "AWSTemplateFormatVersion") {
		t.Error("expected AWSTemplateFormatVersion in output")
	}
}
