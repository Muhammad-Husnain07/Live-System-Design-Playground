package iac

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

type InfraGraph struct {
	Nodes []InfraNode
	Edges []InfraEdge
}

type InfraNode struct {
	ID       string
	NodeType string
	Label    string
	Config   map[string]any
}

type InfraEdge struct {
	Source string
	Target string
}

var terraformTypeToNode = map[string]struct {
	nodeType string
	label    string
	config   map[string]any
}{
	"aws_lb":                          {"LoadBalancer", "Load Balancer", map[string]any{"type": "application", "internal": false}},
	"aws_api_gateway_rest_api":        {"APIGateway", "API Gateway", map[string]any{"protocol": "REST"}},
	"aws_instance":                    {"WebServer", "Web Server", map[string]any{"instances": float64(1), "maxRPS": float64(2000)}},
	"aws_ecs_service":                 {"Microservice", "Microservice", map[string]any{"launch_type": "FARGATE", "desired_count": float64(1)}},
	"aws_db_instance":                 {"PostgreSQLDB", "Database", map[string]any{"engine": "postgres", "engine_version": "16", "instance_class": "db.t3.medium", "allocated_storage": float64(20)}},
	"aws_elasticache_replication_group": {"Redis", "Redis Cache", map[string]any{"engine": "redis", "node_type": "cache.t3.micro"}},
	"aws_elasticsearch_domain":        {"Elasticsearch", "Elasticsearch", map[string]any{"elasticsearch_version": "7.10"}},
	"aws_cloudfront_distribution":     {"CDN", "CDN", nil},
	"aws_route53_zone":                {"DNS", "DNS Zone", nil},
	"aws_network_firewall_firewall":    {"Firewall", "Firewall", nil},
	"aws_vpc":                         {"VPC", "VPC", map[string]any{"cidr_block": "10.0.0.0/16"}},
	"aws_subnet":                      {"Subnet", "Subnet", map[string]any{"cidr_block": "10.0.1.0/24"}},
	"aws_sqs_queue":                   {"MessageQueue", "Message Queue", nil},
	"aws_cloudwatch_event_bus":         {"EventBus", "Event Bus", nil},
	"aws_sns_topic":                   {"PubSub", "Pub/Sub Topic", nil},
	"aws_ecs_cluster":                 {"ContainerCluster", "Container Cluster", nil},
	"aws_lambda_function":             {"ServerlessFunction", "Lambda Function", map[string]any{"runtime": "nodejs20.x", "memory_size": float64(128)}},
	"aws_batch_compute_environment":    {"BatchProcessor", "Batch Processor", nil},
	"aws_sagemaker_endpoint":           {"LLMNode", "LLM Endpoint", map[string]any{"instance_type": "ml.g5.2xlarge", "initial_instance_count": float64(1)}},
	"aws_cloudfront_function":          {"EdgeCompute", "Edge Function", map[string]any{"runtime": "cloudfront-js-2.0"}},
}

var terraformRefRegex = regexp.MustCompile(`\$\{?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_-]+)\.[a-zA-Z0-9_.]+\}?`)

func ParseTerraform(hclContent string) (*InfraGraph, error) {
	re := regexp.MustCompile(`resource\s+"([^"]+)"\s+"([^"]+)"\s*\{`)
	matches := re.FindAllStringSubmatch(hclContent, -1)

	var nodes []InfraNode
	resourceIndex := make(map[string]string)

	used := make(map[string]bool)
	for _, m := range matches {
		if len(m) < 3 {
			continue
		}
		tfType := m[1]
		tfName := m[2]
		resourceID := tfType + "." + tfName
		if used[resourceID] {
			continue
		}
		used[resourceID] = true

		mapping, ok := terraformTypeToNode[tfType]
		if !ok {
			continue
		}

		nodeID := tfType + "_" + tfName
		resourceIndex[resourceID] = nodeID

		cfg := make(map[string]any)
		for k, v := range mapping.config {
			cfg[k] = v
		}
		cfg["region"] = "us-east-1"
		cfg["instances"] = float64(1)
		cfg["maxRPS"] = float64(2000)

		block := extractBlock(hclContent, m[0])
		if instances := extractAttr(block, "desired_count"); instances != "" {
			cfg["instances"] = parseFloat(instances)
		}
		if count := extractAttr(block, "instance_count"); count != "" {
			cfg["instances"] = parseFloat(count)
		}
		if numNodes := extractAttr(block, "num_cache_nodes"); numNodes != "" {
			cfg["instances"] = parseFloat(numNodes)
		}
		if rps := extractAttr(block, "max_rps"); rps != "" {
			cfg["maxRPS"] = parseFloat(rps)
		}
		if rps := extractAttr(block, "capacity"); rps != "" {
			cfg["maxRPS"] = parseFloat(rps)
		}
		if region := extractAttr(block, "region"); region != "" {
			cfg["region"] = region
		}
		if engine := extractAttr(block, "engine"); engine != "" {
			cfg["engine"] = engine
			if engine == "mysql" {
				mapping.nodeType = "MySQLDB"
				mapping.label = "MySQL Database"
			}
		}
		if instanceType := extractAttr(block, "instance_class"); instanceType != "" {
			cfg["instance_class"] = instanceType
		}
		if ami := extractAttr(block, "ami"); ami != "" {
			cfg["ami"] = ami
		}
		if runtime := extractAttr(block, "runtime"); runtime != "" {
			cfg["runtime"] = runtime
		}
		if handler := extractAttr(block, "handler"); handler != "" {
			cfg["handler"] = handler
		}

		label := mapping.label
		if name := extractAttr(block, "name"); name != "" {
			label = name
		}
		if nameAttr := extractAttr(block, "identifier"); nameAttr != "" {
			label = nameAttr
		}

		nodes = append(nodes, InfraNode{
			ID:       nodeID,
			NodeType: mapping.nodeType,
			Label:    label,
			Config:   cfg,
		})
	}

	graph := &InfraGraph{Nodes: nodes}
	inferTerraformEdges(graph, hclContent, resourceIndex)
	return graph, nil
}

func extractBlock(hcl, resourceHeader string) string {
	idx := strings.Index(hcl, resourceHeader)
	if idx < 0 {
		return ""
	}
	block := hcl[idx+len(resourceHeader):]
	depth := 1
	end := 0
	for i, ch := range block {
		if ch == '{' {
			depth++
		} else if ch == '}' {
			depth--
			if depth == 0 {
				end = i
				break
			}
		}
	}
	if end == 0 {
		return ""
	}
	return block[:end]
}

func extractAttr(block, key string) string {
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(key) + `\s*=\s*"([^"]*)"`)
	m := re.FindStringSubmatch(block)
	if len(m) > 1 {
		return m[1]
	}
	re2 := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(key) + `\s*=\s*(\d+)`)
	m2 := re2.FindStringSubmatch(block)
	if len(m2) > 1 {
		return m2[1]
	}
	return ""
}

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

func inferTerraformEdges(graph *InfraGraph, hcl string, resourceIndex map[string]string) {
	refs := terraformRefRegex.FindAllStringSubmatch(hcl, -1)
	nodeByID := make(map[string]*InfraNode)
	for i := range graph.Nodes {
		nodeByID[graph.Nodes[i].ID] = &graph.Nodes[i]
	}

	seen := make(map[string]bool)
	for _, ref := range refs {
		if len(ref) < 3 {
			continue
		}
		targetResource := ref[1] + "." + ref[2]
		targetID, ok := resourceIndex[targetResource]
		if !ok {
			continue
		}
		if _, exists := nodeByID[targetID]; !exists {
			continue
		}

		sourceBlock := extractBlockContaining(hcl, ref[0])
		sourceType := inferSourceType(sourceBlock)
		if sourceType == "" {
			continue
		}
		sourceID := extractResourceID(sourceBlock)
		if sourceID == "" {
			continue
		}

		sourceResID := sourceType + "." + sourceID
		sourceNodeID, ok := resourceIndex[sourceResID]
		if !ok {
			continue
		}
		if _, exists := nodeByID[sourceNodeID]; !exists {
			continue
		}

		key := sourceNodeID + "->" + targetID
		if seen[key] {
			continue
		}
		seen[key] = true
		graph.Edges = append(graph.Edges, InfraEdge{Source: sourceNodeID, Target: targetID})
	}
}

func extractBlockContaining(hcl, substr string) string {
	idx := strings.Index(hcl, substr)
	if idx < 0 {
		return ""
	}

	start := idx
	for start > 0 {
		lineStart := strings.LastIndex(hcl[:start], "\nresource ")
		if lineStart >= 0 {
			start = lineStart
			break
		}
		start--
	}

	return extractBlock(hcl, hcl[start:])
}

func inferSourceType(block string) string {
	re := regexp.MustCompile(`resource\s+"([^"]+)"`)
	m := re.FindStringSubmatch(block)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

func extractResourceID(block string) string {
	re := regexp.MustCompile(`resource\s+"[^"]+"\s+"([^"]+)"`)
	m := re.FindStringSubmatch(block)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

func ParseKubernetes(yamlContent string) (*InfraGraph, error) {
	docs := strings.Split(yamlContent, "\n---\n")
	var nodes []InfraNode
	services := make(map[string]map[string]string)
	deployments := make(map[string]map[string]string)

	for _, doc := range docs {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}

		var resource map[string]any
		if err := yaml.Unmarshal([]byte(doc), &resource); err != nil {
			continue
		}

		kind, _ := resource["kind"].(string)
		meta, _ := resource["metadata"].(map[string]any)
		name, _ := meta["name"].(string)
		if name == "" {
			continue
		}
		labels, _ := meta["labels"].(map[string]any)
		labelMap := make(map[string]string)
		for k, v := range labels {
			labelMap[k] = fmt.Sprintf("%v", v)
		}

		switch kind {
		case "Deployment":
			spec, _ := resource["spec"].(map[string]any)
			template, _ := spec["template"].(map[string]any)
			tmplMeta, _ := template["metadata"].(map[string]any)
			podLabels, _ := tmplMeta["labels"].(map[string]any)
			podLabelMap := make(map[string]string)
			for k, v := range podLabels {
				podLabelMap[k] = fmt.Sprintf("%v", v)
			}
			replicas := 1
			if r, ok := spec["replicas"].(int); ok {
				replicas = r
			}
			containers, _ := template["spec"].(map[string]any)["containers"].([]any)
			image := ""
			if len(containers) > 0 {
				if c, ok := containers[0].(map[string]any); ok {
					image, _ = c["image"].(string)
				}
			}

			deployments[name] = podLabelMap

			cfg := map[string]any{
				"instances": float64(replicas),
				"maxRPS":    float64(2000),
				"region":    "us-east-1",
			}
			if image != "" {
				cfg["image"] = image
			}

			nt := "WebServer"
			if strings.Contains(image, "nginx") || strings.Contains(image, "apache") {
				nt = "WebServer"
			} else if strings.Contains(image, "api") || strings.Contains(image, "app") {
				nt = "AppServer"
			}

			nodes = append(nodes, InfraNode{
				ID:       "deployment_" + name,
				NodeType: nt,
				Label:    name,
				Config:   cfg,
			})

		case "StatefulSet":
			spec, _ := resource["spec"].(map[string]any)
			template, _ := spec["template"].(map[string]any)
			tmplMeta, _ := template["metadata"].(map[string]any)
			podLabels, _ := tmplMeta["labels"].(map[string]any)
			podLabelMap := make(map[string]string)
			for k, v := range podLabels {
				podLabelMap[k] = fmt.Sprintf("%v", v)
			}
			deployments[name] = podLabelMap

			containers, _ := template["spec"].(map[string]any)["containers"].([]any)
			image := ""
			if len(containers) > 0 {
				if c, ok := containers[0].(map[string]any); ok {
					image, _ = c["image"].(string)
				}
			}

			nt := "PostgreSQLDB"
			if strings.Contains(image, "mysql") {
				nt = "MySQLDB"
			} else if strings.Contains(image, "mongo") {
				nt = "MongoDB"
			} else if strings.Contains(image, "redis") {
				nt = "Redis"
			} else if strings.Contains(image, "elastic") {
				nt = "Elasticsearch"
			}

			nodes = append(nodes, InfraNode{
				ID:       "statefulset_" + name,
				NodeType: nt,
				Label:    name,
				Config: map[string]any{
					"instances": float64(1),
					"maxRPS":    float64(1000),
					"region":    "us-east-1",
				},
			})

		case "Service":
			spec, _ := resource["spec"].(map[string]any)
			selector, _ := spec["selector"].(map[string]any)
			selMap := make(map[string]string)
			for k, v := range selector {
				selMap[k] = fmt.Sprintf("%v", v)
			}
			svcType, _ := spec["type"].(string)
			if svcType == "" {
				svcType = "ClusterIP"
			}
			services[name] = selMap

			if svcType == "LoadBalancer" {
				nodes = append(nodes, InfraNode{
					ID:       "service_" + name,
					NodeType: "LoadBalancer",
					Label:    name + "-lb",
					Config: map[string]any{
						"type":      "application",
						"internal":  false,
						"instances": float64(2),
						"maxRPS":    float64(10000),
						"region":    "us-east-1",
					},
				})
			}

		case "Ingress":
			spec, _ := resource["spec"].(map[string]any)
			rules, _ := spec["rules"].([]any)
			if len(rules) > 0 {
				nodes = append(nodes, InfraNode{
					ID:       "ingress_" + name,
					NodeType: "APIGateway",
					Label:    name,
					Config: map[string]any{
						"protocol":  "REST",
						"instances": float64(2),
						"maxRPS":    float64(5000),
						"region":    "us-east-1",
					},
				})
			}

		case "ConfigMap":
			nt := cloudTypeToNode(name)
			if nt != "" {
				data, _ := resource["data"].(map[string]any)
				cfg := map[string]any{
					"instances": float64(1),
					"maxRPS":    float64(1000),
					"region":    "us-east-1",
				}
				for k, v := range data {
					cfg[k] = v
				}
				nodes = append(nodes, InfraNode{
					ID:       "configmap_" + name,
					NodeType: nt,
					Label:    name,
					Config:   cfg,
				})
			}
		}
	}

	graph := &InfraGraph{Nodes: nodes}
	inferK8sEdges(graph, services, deployments)
	return graph, nil
}

func cloudTypeToNode(name string) string {
	switch {
	case strings.Contains(name, "queue"):
		return "MessageQueue"
	case strings.Contains(name, "topic"):
		return "PubSub"
	case strings.Contains(name, "eventbus"):
		return "EventBus"
	case strings.Contains(name, "fn") || strings.Contains(name, "lambda") || strings.Contains(name, "function"):
		return "ServerlessFunction"
	case strings.Contains(name, "cluster"):
		return "ContainerCluster"
	case strings.Contains(name, "cdn"):
		return "CDN"
	case strings.Contains(name, "dns"):
		return "DNS"
	case strings.Contains(name, "fw"):
		return "Firewall"
	case strings.Contains(name, "vpc"):
		return "VPC"
	case strings.Contains(name, "subnet"):
		return "Subnet"
	case strings.Contains(name, "batch"):
		return "BatchProcessor"
	case strings.Contains(name, "edge") || strings.Contains(name, "cloudfront"):
		return "EdgeCompute"
	case strings.Contains(name, "llm") || strings.Contains(name, "sagemaker"):
		return "LLMNode"
	case strings.Contains(name, "gpu") || strings.Contains(name, "p3") || strings.Contains(name, "p4d"):
		return "GPUCluster"
	case strings.Contains(name, "snapstart") || strings.Contains(name, "serverlessv2"):
		return "ServerlessV2"
	}
	return ""
}

func inferK8sEdges(graph *InfraGraph, services, deployments map[string]map[string]string) {
	nodeIndex := make(map[string]bool)
	for _, n := range graph.Nodes {
		nodeIndex[n.ID] = true
	}

	for svcName, selector := range services {
		for depName, labels := range deployments {
			if labelsMatch(selector, labels) {
				svcID := "service_" + svcName
				depID := "deployment_" + depName
				if nodeIndex[svcID] && nodeIndex[depID] {
					graph.Edges = append(graph.Edges, InfraEdge{Source: svcID, Target: depID})
				}
			}
		}
	}
}

func labelsMatch(selector, labels map[string]string) bool {
	for k, v := range selector {
		if lv, ok := labels[k]; !ok || lv != v {
			return false
		}
	}
	return len(selector) > 0
}

var cfResourceTypeToNode = map[string]struct {
	nodeType string
	label    string
}{
	"AWS::ElasticLoadBalancingV2::LoadBalancer": {"LoadBalancer", "Load Balancer"},
	"AWS::ApiGateway::RestApi":                   {"APIGateway", "API Gateway"},
	"AWS::EC2::Instance":                         {"WebServer", "Web Server"},
	"AWS::ECS::Service":                          {"Microservice", "Microservice"},
	"AWS::RDS::DBInstance":                       {"PostgreSQLDB", "Database"},
	"AWS::ElastiCache::ReplicationGroup":         {"Redis", "Redis Cache"},
	"AWS::Elasticsearch::Domain":                 {"Elasticsearch", "Elasticsearch"},
	"AWS::CloudFront::Distribution":              {"CDN", "CDN"},
	"AWS::Route53::HostedZone":                   {"DNS", "DNS Zone"},
	"AWS::NetworkFirewall::Firewall":             {"Firewall", "Firewall"},
	"AWS::EC2::VPC":                              {"VPC", "VPC"},
	"AWS::EC2::Subnet":                           {"Subnet", "Subnet"},
	"AWS::SQS::Queue":                            {"MessageQueue", "Message Queue"},
	"AWS::Events::EventBus":                      {"EventBus", "Event Bus"},
	"AWS::SNS::Topic":                            {"PubSub", "Pub/Sub Topic"},
	"AWS::ECS::Cluster":                          {"ContainerCluster", "Container Cluster"},
	"AWS::Lambda::Function":                      {"ServerlessFunction", "Lambda Function"},
	"AWS::Batch::ComputeEnvironment":             {"BatchProcessor", "Batch Processor"},
	"AWS::SageMaker::Endpoint":                   {"LLMNode", "LLM Endpoint"},
	"AWS::CloudFront::Function":                  {"EdgeCompute", "Edge Function"},
}

func ParseCloudFormation(jsonContent string) (*InfraGraph, error) {
	var cf map[string]any
	if err := json.Unmarshal([]byte(jsonContent), &cf); err != nil {
		return nil, fmt.Errorf("invalid CloudFormation JSON: %w", err)
	}

	resourcesRaw, ok := cf["Resources"]
	if !ok {
		return nil, fmt.Errorf("missing Resources key")
	}
	resources, ok := resourcesRaw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("Resources must be an object")
	}

	var nodes []InfraNode
	resourceIndex := make(map[string]string)
	contentMap := make(map[string]map[string]any)

	for logicalID, resRaw := range resources {
		res, ok := resRaw.(map[string]any)
		if !ok {
			continue
		}
		resType, _ := res["Type"].(string)
		if resType == "" {
			continue
		}

		mapping, ok := cfResourceTypeToNode[resType]
		if !ok {
			continue
		}

		nodeID := logicalID
		resourceIndex[logicalID] = nodeID
		props, _ := res["Properties"].(map[string]any)
		contentMap[logicalID] = props

		cfg := map[string]any{
			"instances": float64(1),
			"maxRPS":    float64(2000),
			"region":    "us-east-1",
		}

		if p := extractCFString(props, "Engine"); p != "" {
			cfg["engine"] = p
			if p == "mysql" {
				mapping.nodeType = "MySQLDB"
				mapping.label = "MySQL Database"
			}
		}
		if p := extractCFString(props, "DBInstanceClass"); p != "" {
			cfg["instance_class"] = p
		}
		if p := extractCFString(props, "InstanceClass"); p != "" {
			cfg["instance_class"] = p
		}
		if p := extractCFString(props, "Runtime"); p != "" {
			cfg["runtime"] = p
		}
		if p := extractCFString(props, "Handler"); p != "" {
			cfg["handler"] = p
		}
		if rps := extractCFNumber(props, "ProvisionedConcurrency"); rps > 0 {
			cfg["maxRPS"] = rps
		}

		label := mapping.label
		if name := extractCFString(props, "Name"); name != "" {
			label = name
		}
		if dbName := extractCFString(props, "DBInstanceIdentifier"); dbName != "" {
			label = dbName
		}
		if dnsName := extractCFString(props, "HostedZoneName"); dnsName != "" {
			label = dnsName
		}

		nodes = append(nodes, InfraNode{
			ID:       nodeID,
			NodeType: mapping.nodeType,
			Label:    label,
			Config:   cfg,
		})
	}

	graph := &InfraGraph{Nodes: nodes}
	inferCFEdges(graph, contentMap, resourceIndex)
	return graph, nil
}

func extractCFString(props map[string]any, key string) string {
	if v, ok := props[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func extractCFNumber(props map[string]any, key string) float64 {
	if v, ok := props[key]; ok {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		}
	}
	return 0
}

func inferCFEdges(graph *InfraGraph, contentMap map[string]map[string]any, resourceIndex map[string]string) {
	seen := make(map[string]bool)

	for logicalID, props := range contentMap {
		if _, ok := resourceIndex[logicalID]; !ok {
			continue
		}

		refs := extractCFRefs(props)
		for _, targetLogical := range refs {
			targetID, ok := resourceIndex[targetLogical]
			if !ok {
				continue
			}
			key := logicalID + "->" + targetLogical
			if seen[key] {
				continue
			}
			seen[key] = true
			graph.Edges = append(graph.Edges, InfraEdge{Source: logicalID, Target: targetID})
		}
	}
}

func extractCFRefs(props map[string]any) []string {
	var refs []string

	var walk func(v any)
	walk = func(v any) {
		switch val := v.(type) {
		case map[string]any:
			if ref, ok := val["Ref"]; ok {
				if s, ok := ref.(string); ok {
					refs = append(refs, s)
				}
				return
			}
			if fnGA, ok := val["Fn::GetAtt"]; ok {
				switch arr := fnGA.(type) {
				case []any:
					if len(arr) > 0 {
						if s, ok := arr[0].(string); ok {
							refs = append(refs, s)
						}
					}
				case []string:
					if len(arr) > 0 {
						refs = append(refs, arr[0])
					}
				}
				return
			}
			for _, child := range val {
				walk(child)
			}
		case []any:
			for _, child := range val {
				walk(child)
			}
		}
	}

	walk(props)
	return refs
}

func ToCanvasData(graph *InfraGraph) CanvasData {
	nodes := make([]CanvasNodeData, 0, len(graph.Nodes))
	for _, n := range graph.Nodes {
		d := map[string]any{
			"nodeType": n.NodeType,
			"label":    n.Label,
			"config":   n.Config,
		}
		nodes = append(nodes, CanvasNodeData{
			ID:       n.ID,
			NodeType: n.NodeType,
			Data:     d,
		})
	}

	edges := make([]CanvasEdgeData, 0, len(graph.Edges))
	for _, e := range graph.Edges {
		edgeID := fmt.Sprintf("e-%s-%s", e.Source, e.Target)
		edges = append(edges, CanvasEdgeData{
			ID:     edgeID,
			Source: e.Source,
			Target: e.Target,
		})
	}

	return CanvasData{Nodes: nodes, Edges: edges}
}
