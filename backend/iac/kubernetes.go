package iac

import (
	"bytes"
	"fmt"
	"sort"
	"text/template"
)

const k8sTemplate = `# Kubernetes manifests generated from system design canvas
# API version: apps/v1
---
{{- range .Resources}}
{{- if eq .Type "aws_ecs_service"}}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{index .Properties "name" | default .ID}}
  labels:
    app: {{index .Properties "name" | default .ID}}
spec:
  replicas: {{index .Properties "desired_count" | default 1 | int}}
  selector:
    matchLabels:
      app: {{index .Properties "name" | default .ID}}
  template:
    metadata:
      labels:
        app: {{index .Properties "name" | default .ID}}
    spec:
      containers:
      - name: {{index .Properties "name" | default .ID}}
        image: "{{index .Properties "name" | default .ID}}:latest"
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-svc
  labels:
    app: {{index .Properties "name" | default .ID}}
spec:
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
{{- end}}
{{- if eq .Type "aws_lb"}}
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-lb
spec:
  type: LoadBalancer
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 80
    targetPort: 8080
{{- end}}
{{- if eq .Type "aws_api_gateway_rest_api"}}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{index .Properties "name" | default .ID}}-ingress
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{index .Properties "name" | default .ID}}-svc
            port:
              number: 80
{{- end}}
{{- if eq .Type "aws_db_instance"}}
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{index .Properties "name" | default .ID}}-db
spec:
  serviceName: {{index .Properties "name" | default .ID}}-db
  replicas: {{index .Properties "instances" | default 1 | int}}
  selector:
    matchLabels:
      app: {{index .Properties "name" | default .ID}}
  template:
    metadata:
      labels:
        app: {{index .Properties "name" | default .ID}}
    spec:
      containers:
      - name: db
        image: "{{if eq (index .Properties "engine") "postgres"}}postgres:16{{else if eq (index .Properties "engine") "mysql"}}mysql:8.0{{else}}postgres:16{{end}}"
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_PASSWORD
          value: changeme
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-db
spec:
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
{{- end}}
{{- if eq .Type "aws_elasticache_replication_group"}}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{index .Properties "name" | default .ID}}-cache
spec:
  replicas: {{index .Properties "num_cache_nodes" | default 1 | int}}
  selector:
    matchLabels:
      app: {{index .Properties "name" | default .ID}}
  template:
    metadata:
      labels:
        app: {{index .Properties "name" | default .ID}}
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-cache
spec:
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
{{- end}}
{{- if eq .Type "aws_elasticsearch_domain"}}
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{index .Properties "name" | default .ID}}-es
spec:
  serviceName: {{index .Properties "name" | default .ID}}-es
  replicas: {{index .Properties "instance_count" | default 1 | int}}
  selector:
    matchLabels:
      app: {{index .Properties "name" | default .ID}}
  template:
    metadata:
      labels:
        app: {{index .Properties "name" | default .ID}}
    spec:
      containers:
      - name: elasticsearch
        image: elasticsearch:7.10.1
        ports:
        - containerPort: 9200
        env:
        - name: discovery.type
          value: single-node
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-es
spec:
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 9200
    targetPort: 9200
  type: ClusterIP
{{- end}}
{{- if eq .Type "aws_sqs_queue"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-queue
data:
  type: "sqs"
  name: {{index .Properties "name" | default .ID}}
{{- end}}
{{- if eq .Type "aws_sns_topic"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-topic
data:
  type: "sns"
  name: {{index .Properties "name" | default .ID}}
{{- end}}
{{- if eq .Type "aws_lambda_function"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-fn
data:
  runtime: {{index .Properties "runtime" | default "nodejs20.x"}}
  handler: {{index .Properties "handler" | default "index.handler"}}
{{- end}}
{{- if eq .Type "aws_ecs_cluster"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-cluster
data:
  type: "ecs-cluster"
{{- end}}
{{- if eq .Type "aws_cloudfront_distribution"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-cdn
data:
  type: "cloudfront"
{{- end}}
{{- if eq .Type "aws_route53_zone"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-dns
data:
  type: "route53"
{{- end}}
{{- if eq .Type "aws_network_firewall_firewall"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-fw
data:
  type: "network-firewall"
{{- end}}
{{- if eq .Type "aws_vpc"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-vpc
data:
  type: "vpc"
{{- end}}
{{- if eq .Type "aws_subnet"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-subnet
data:
  type: "subnet"
{{- end}}
{{- if eq .Type "aws_cloudwatch_event_bus"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-eventbus
data:
  type: "eventbridge"
{{- end}}
{{- if eq .Type "aws_batch_compute_environment"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-batch
data:
  type: "batch"
{{- end}}
{{- if eq .Type "aws_sagemaker_endpoint"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-llm
data:
  type: "sagemaker-endpoint"
  instance_type: {{index .Properties "instance_type" | default "ml.g5.2xlarge"}}
{{- end}}
{{- if eq .Type "aws_cloudfront_function"}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{index .Properties "name" | default .ID}}-edge
data:
  type: "cloudfront-function"
  runtime: {{index .Properties "runtime" | default "cloudfront-js-2.0"}}
{{- end}}
{{- if eq .Type "aws_instance"}}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{index .Properties "name" | default .ID}}
spec:
  replicas: {{index .Properties "instances" | default 1 | int}}
  selector:
    matchLabels:
      app: {{index .Properties "name" | default .ID}}
  template:
    metadata:
      labels:
        app: {{index .Properties "name" | default .ID}}
    spec:
      containers:
      - name: app
        image: "{{index .Properties "name" | default "app"}}:latest"
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: {{index .Properties "name" | default .ID}}-svc
spec:
  selector:
    app: {{index .Properties "name" | default .ID}}
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
{{- end}}
{{end}}
`

var k8sFuncs = template.FuncMap{
	"default": func(def, v any) any {
		if v == nil || v == "" || v == 0 {
			return def
		}
		return v
	},
	"int": func(v any) int {
		switch val := v.(type) {
		case float64:
			return int(val)
		case int:
			return val
		default:
			return 1
		}
	},
}

func GenerateKubernetes(data ExportData) (string, error) {
	tmpl, err := template.New("k8s").Funcs(k8sFuncs).Parse(k8sTemplate)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}

	sort.Slice(data.Resources, func(i, j int) bool {
		return data.Resources[i].Type < data.Resources[j].Type
	})

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}

	return buf.String(), nil
}
