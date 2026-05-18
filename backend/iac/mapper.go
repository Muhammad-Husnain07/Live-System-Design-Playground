package iac

import (
	"encoding/json"
	"fmt"
	"strings"
)

func ParseCanvasData(raw []byte) (ExportData, error) {
	var canvas CanvasData
	if err := json.Unmarshal(raw, &canvas); err != nil {
		return ExportData{}, fmt.Errorf("invalid canvas JSON: %w", err)
	}

	edges := make([]Edge, 0, len(canvas.Edges))
	for _, e := range canvas.Edges {
		edges = append(edges, Edge{Source: e.Source, Target: e.Target})
	}

	resources := make([]Resource, 0, len(canvas.Nodes))
	resByID := make(map[string]Resource, len(canvas.Nodes))

	for _, nd := range canvas.Nodes {
		r := mapNode(nd)
		if r == nil {
			continue
		}
		resources = append(resources, *r)
		resByID[nd.ID] = *r
	}

	depMap := make(map[string]map[string]bool)
	for _, e := range canvas.Edges {
		if _, ok := resByID[e.Source]; !ok {
			continue
		}
		if _, ok := resByID[e.Target]; !ok {
			continue
		}
		if depMap[e.Target] == nil {
			depMap[e.Target] = make(map[string]bool)
		}
		depMap[e.Target][e.Source] = true
	}

	for i, r := range resources {
		if deps, ok := depMap[r.ID]; ok {
			for d := range deps {
				resources[i].DependsOn = append(resources[i].DependsOn, resByID[d].Type+"."+SanitizeID(d))
			}
		}
	}

	return ExportData{
		Resources:    resources,
		ResourceByID: resByID,
		Edges:        edges,
	}, nil
}

func str(data map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := data[k]; ok && v != nil {
			if s, ok := v.(string); ok {
				return s
			}
		}
	}
	return ""
}

func flt64(data map[string]any, key string) float64 {
	if v, ok := data[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		}
	}
	return 0
}

func mapNode(nd CanvasNodeData) *Resource {
	cfg := make(map[string]any)
	if nd.Data != nil {
		if c, ok := nd.Data["config"]; ok && c != nil {
			if m, ok := c.(map[string]any); ok {
				cfg = m
			}
		}
	}

	label := str(nd.Data, "label")
	region := str(cfg, "region")
	instances := flt64(cfg, "instances")
	maxRPS := flt64(cfg, "maxRPS")

	props := map[string]any{
		"name":          label,
		"region":        region,
		"instances":     instances,
		"maxRPS":        maxRPS,
	}

	switch nd.NodeType {
	case "LoadBalancer":
		return &Resource{
			ID: nd.ID, Type: "aws_lb", Provider: "aws",
			Properties: merge(props, map[string]any{
				"type": "application", "internal": false,
			}),
		}
	case "APIGateway":
		return &Resource{
			ID: nd.ID, Type: "aws_api_gateway_rest_api", Provider: "aws",
			Properties: merge(props, map[string]any{
				"protocol": "REST",
			}),
		}
	case "WebServer":
		return &Resource{
			ID: nd.ID, Type: "aws_instance", Provider: "aws",
			Properties: merge(props, map[string]any{
				"ami": "ami-0c55b159cbfafe1f0", "instance_type": pickInstanceType(instances, maxRPS),
			}),
		}
	case "AppServer":
		return &Resource{
			ID: nd.ID, Type: "aws_instance", Provider: "aws",
			Properties: merge(props, map[string]any{
				"ami": "ami-0c55b159cbfafe1f0", "instance_type": pickInstanceType(instances, maxRPS),
			}),
		}
	case "Microservice":
		return &Resource{
			ID: nd.ID, Type: "aws_ecs_service", Provider: "aws",
			Properties: merge(props, map[string]any{
				"launch_type": "FARGATE", "desired_count": instances,
			}),
		}
	case "PostgreSQLDB":
		return &Resource{
			ID: nd.ID, Type: "aws_db_instance", Provider: "aws",
			Properties: merge(props, map[string]any{
				"engine": "postgres", "engine_version": "16", "instance_class": "db.t3.medium",
				"allocated_storage": 20, "storage_type": "gp3",
			}),
		}
	case "MySQLDB":
		return &Resource{
			ID: nd.ID, Type: "aws_db_instance", Provider: "aws",
			Properties: merge(props, map[string]any{
				"engine": "mysql", "engine_version": "8.0", "instance_class": "db.t3.medium",
				"allocated_storage": 20, "storage_type": "gp3",
			}),
		}
	case "MongoDB":
		return &Resource{
			ID: nd.ID, Type: "aws_instance", Provider: "aws",
			Properties: merge(props, map[string]any{
				"ami": "ami-0c55b159cbfafe1f0", "instance_type": "t3.medium",
			}),
		}
	case "Redis":
		return &Resource{
			ID: nd.ID, Type: "aws_elasticache_replication_group", Provider: "aws",
			Properties: merge(props, map[string]any{
				"engine": "redis", "node_type": "cache.t3.micro", "num_cache_nodes": instances,
			}),
		}
	case "Elasticsearch":
		return &Resource{
			ID: nd.ID, Type: "aws_elasticsearch_domain", Provider: "aws",
			Properties: merge(props, map[string]any{
				"elasticsearch_version": "7.10", "instance_type": "t3.small.elasticsearch",
				"instance_count": instances,
			}),
		}
	case "CDN":
		return &Resource{
			ID: nd.ID, Type: "aws_cloudfront_distribution", Provider: "aws",
			Properties: props,
		}
	case "DNS":
		return &Resource{
			ID: nd.ID, Type: "aws_route53_zone", Provider: "aws",
			Properties: props,
		}
	case "Firewall":
		return &Resource{
			ID: nd.ID, Type: "aws_network_firewall_firewall", Provider: "aws",
			Properties: props,
		}
	case "VPC":
		return &Resource{
			ID: nd.ID, Type: "aws_vpc", Provider: "aws",
			Properties: merge(props, map[string]any{
				"cidr_block": "10.0.0.0/16",
			}),
		}
	case "Subnet":
		return &Resource{
			ID: nd.ID, Type: "aws_subnet", Provider: "aws",
			Properties: merge(props, map[string]any{
				"cidr_block": "10.0.1.0/24",
			}),
		}
	case "MessageQueue":
		return &Resource{
			ID: nd.ID, Type: "aws_sqs_queue", Provider: "aws",
			Properties: props,
		}
	case "EventBus":
		return &Resource{
			ID: nd.ID, Type: "aws_cloudwatch_event_bus", Provider: "aws",
			Properties: props,
		}
	case "PubSub":
		return &Resource{
			ID: nd.ID, Type: "aws_sns_topic", Provider: "aws",
			Properties: props,
		}
	case "ContainerCluster":
		return &Resource{
			ID: nd.ID, Type: "aws_ecs_cluster", Provider: "aws",
			Properties: props,
		}
	case "ServerlessFunction":
		return &Resource{
			ID: nd.ID, Type: "aws_lambda_function", Provider: "aws",
			Properties: merge(props, map[string]any{
				"runtime": "nodejs20.x", "handler": "index.handler",
				"memory_size": 128, "timeout": 30,
			}),
		}
	case "BatchProcessor":
		return &Resource{
			ID: nd.ID, Type: "aws_batch_compute_environment", Provider: "aws",
			Properties: props,
		}
	case "WorkerService":
		return &Resource{
			ID: nd.ID, Type: "aws_ecs_service", Provider: "aws",
			Properties: merge(props, map[string]any{
				"launch_type": "FARGATE", "desired_count": instances,
			}),
		}
	}
	return nil
}

func merge(a, b map[string]any) map[string]any {
	for k, v := range b {
		a[k] = v
	}
	return a
}

func pickInstanceType(instances float64, maxRPS float64) string {
	if maxRPS > 5000 || instances < 2 {
		return "t3.large"
	}
	return "t3.medium"
}

func SanitizeID(id string) string {
	s := strings.NewReplacer("-", "_", " ", "_", ".", "_").Replace(id)
	return "resource_" + s
}

func Quote(s string) string {
	return fmt.Sprintf("%q", s)
}
