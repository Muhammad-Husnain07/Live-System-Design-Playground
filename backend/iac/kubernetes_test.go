package iac

import (
	"strings"
	"testing"
)

func TestGenerateKubernetesBasicWebApp(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-k8s",
		ProjectName: "K8sApp",
		Resources: []Resource{
			{ID: "web", Type: "aws_ecs_service", Provider: "kubernetes", Properties: map[string]any{
				"desired_count": float64(3), "name": "web-app",
			}},
			{ID: "db", Type: "aws_db_instance", Provider: "kubernetes", Properties: map[string]any{
				"instances": float64(1), "engine": "postgres", "name": "pg-db",
			}},
		},
		Edges: []Edge{
			{Source: "web", Target: "db"},
		},
	}
	yaml, err := GenerateKubernetes(data)
	if err != nil {
		t.Fatalf("GenerateKubernetes failed: %v", err)
	}
	if yaml == "" {
		t.Fatal("expected non-empty YAML output")
	}
	if !strings.Contains(yaml, "apiVersion:") {
		t.Error("expected apiVersion in YAML output")
	}
	if !strings.Contains(yaml, "kind: Deployment") {
		t.Error("expected Deployment kind in YAML")
	}
	if !strings.Contains(yaml, "kind: Service") {
		t.Error("expected Service kind in YAML")
	}
	if !strings.Contains(yaml, "kind: StatefulSet") {
		t.Error("expected StatefulSet kind for database")
	}
	if !strings.Contains(yaml, "web-app:latest") {
		t.Error("expected web-app:latest image reference")
	}
	if !strings.Contains(yaml, "postgres:16") {
		t.Error("expected postgres:16 image reference")
	}
}

func TestGenerateKubernetesWithLoadBalancer(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-lb",
		ProjectName: "LBApp",
		Resources: []Resource{
			{ID: "lb", Type: "aws_lb", Provider: "kubernetes", Properties: map[string]any{
				"name": "main-lb",
			}},
			{ID: "web", Type: "aws_ecs_service", Provider: "kubernetes", Properties: map[string]any{
				"desired_count": float64(2), "name": "web-svc",
			}},
		},
		Edges: []Edge{
			{Source: "lb", Target: "web"},
		},
	}
	yaml, err := GenerateKubernetes(data)
	if err != nil {
		t.Fatalf("GenerateKubernetes failed: %v", err)
	}
	if !strings.Contains(yaml, "kind: Service") {
		t.Error("expected Service kind")
	}
	if !strings.Contains(yaml, "type: LoadBalancer") {
		t.Error("expected LoadBalancer service type")
	}
	if !strings.Contains(yaml, "main-lb-lb") {
		t.Error("expected load balancer service name")
	}
}

func TestGenerateKubernetesModernTypes(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-k8s-modern",
		ProjectName: "K8sModern",
		Resources: []Resource{
			{ID: "gpu", Type: "aws_instance", Provider: "kubernetes", Properties: map[string]any{"name": "gpu-cluster"}},
			{ID: "llm", Type: "aws_sagemaker_endpoint", Provider: "kubernetes", Properties: map[string]any{"name": "llm-service"}},
			{ID: "edge", Type: "aws_cloudfront_function", Provider: "kubernetes", Properties: map[string]any{"name": "edge-cache"}},
			{ID: "sv2", Type: "aws_lambda_function", Provider: "kubernetes", Properties: map[string]any{"name": "serverless-v2"}},
		},
		Edges: []Edge{},
	}
	yaml, err := GenerateKubernetes(data)
	if err != nil {
		t.Fatalf("GenerateKubernetes failed: %v", err)
	}
	if yaml == "" {
		t.Fatal("expected non-empty YAML output")
	}
	// aws_instance is already handled by the K8s template (as Deployment)
	if !strings.Contains(yaml, "gpu-cluster") {
		t.Error("expected 'gpu-cluster' in YAML output from aws_instance")
	}
	// aws_lambda_function is already handled by the K8s template (as ConfigMap)
	if !strings.Contains(yaml, "serverless-v2") {
		t.Error("expected 'serverless-v2' in YAML output from aws_lambda_function")
	}
}

func TestGenerateKubernetesEmptyData(t *testing.T) {
	data := ExportData{
		ProjectID:   "proj-empty",
		ProjectName: "Empty",
		Resources:   []Resource{},
		Edges:       []Edge{},
	}
	yaml, err := GenerateKubernetes(data)
	if err != nil {
		t.Fatalf("GenerateKubernetes failed: %v", err)
	}
	if yaml == "" {
		t.Fatal("expected non-empty YAML even for empty resources")
	}
}
