import { NODE_REGISTRY } from "./nodeRegistry";
import type { NodeType, NodeConfig } from "../types/canvas";

function getNodes() {
  const { useCanvasStore } = require("../store/canvasStore");
  return useCanvasStore.getState().nodes;
}

function getEdges() {
  const { useCanvasStore } = require("../store/canvasStore");
  return useCanvasStore.getState().edges;
}

function resourceName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function genTerraformNode(nt: NodeType, cfg: NodeConfig, label: string, name: string): string {
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    return [
      `resource "aws_lb" "${name}" {`,
      `  name               = "${label}"`,
      `  internal           = ${!cfg.security.isPublicFacing}`,
      `  load_balancer_type = "${nt === "APIGateway" ? "application" : "network"}"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    return [
      `resource "aws_instance" "${name}" {`,
      `  ami           = "ami-0c55b159cbfafe1f0"`,
      `  instance_type = "t3.medium"`,
      `  monitoring    = true`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "PostgreSQLDB" || nt === "MySQLDB") {
    const engine = nt === "PostgreSQLDB" ? "postgres" : "mysql";
    return [
      `resource "aws_db_instance" "${name}" {`,
      `  identifier        = "${name}"`,
      `  engine            = "${engine}"`,
      `  instance_class    = "db.t3.medium"`,
      `  allocated_storage = 20`,
      `  skip_final_snapshot = true`,
      `  publicly_accessible = ${cfg.security.isPublicFacing}`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Redis") {
    return [
      `resource "aws_elasticache_cluster" "${name}" {`,
      `  cluster_id           = "${name}"`,
      `  engine               = "redis"`,
      `  node_type            = "cache.t3.micro"`,
      `  num_cache_nodes      = 1`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MongoDB" || nt === "Elasticsearch") {
    return [
      `resource "aws_instance" "${name}" {`,
      `  ami           = "ami-0c55b159cbfafe1f0"`,
      `  instance_type = "t3.large"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "CDN") {
    return [
      `resource "aws_cloudfront_distribution" "${name}" {`,
      `  enabled = true`,
      `  default_cache_behavior {`,
      `    allowed_methods  = ["GET", "HEAD"]`,
      `    cached_methods   = ["GET", "HEAD"]`,
      `    target_origin_id = "${name}-origin"`,
      `    viewer_protocol_policy = "allow-all"`,
      `  }`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "DNS") {
    return [
      `resource "aws_route53_zone" "${name}" {`,
      `  name = "${label}.example.com"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Firewall") {
    return [
      `resource "aws_security_group" "${name}" {`,
      `  name        = "${label}"`,
      `  description = "${label} firewall rules"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MessageQueue") {
    return [
      `resource "aws_sqs_queue" "${name}" {`,
      `  name                      = "${name}"`,
      `  delay_seconds             = 0`,
      `  max_message_size          = 262144`,
      `  visibility_timeout_seconds = 30`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "EventBus" || nt === "PubSub") {
    return [
      `resource "aws_sns_topic" "${name}" {`,
      `  name = "${name}"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ContainerCluster") {
    return [
      `resource "aws_eks_cluster" "${name}" {`,
      `  name     = "${name}"`,
      `  role_arn = aws_iam_role.${name}.arn`,
      `  vpc_config { subnet_ids = [] }`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ServerlessFunction") {
    return [
      `resource "aws_lambda_function" "${name}" {`,
      `  function_name = "${name}"`,
      `  runtime       = "nodejs20.x"`,
      `  handler       = "index.handler"`,
      `  role          = aws_iam_role.${name}_lambda.arn`,
      `  timeout       = ${cfg.latencyMs}`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "VPC") {
    return [
      `resource "aws_vpc" "${name}" {`,
      `  cidr_block = "10.0.0.0/16"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Subnet") {
    return [
      `resource "aws_subnet" "${name}" {`,
      `  vpc_id     = aws_vpc.default.id`,
      `  cidr_block = "10.0.1.0/24"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  return "";
}

function genK8sNode(nt: NodeType, cfg: NodeConfig, label: string, name: string): string {
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    return [
      "---",
      `apiVersion: v1`,
      `kind: Service`,
      `metadata:`,
      `  name: ${name}`,
      `  labels: { app: ${name} }`,
      `spec:`,
      `  type: LoadBalancer`,
      `  selector: { app: ${name} }`,
      `  ports:`,
      `    - port: 80`,
      `      targetPort: 8080`,
      "",
    ].join("\n");
  }
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    return [
      "---",
      `apiVersion: apps/v1`,
      `kind: Deployment`,
      `metadata:`,
      `  name: ${name}`,
      `  labels: { app: ${name} }`,
      `spec:`,
      `  replicas: ${cfg.instances}`,
      `  selector: { matchLabels: { app: ${name} } }`,
      `  template:`,
      `    metadata: { labels: { app: ${name} } }`,
      `    spec:`,
      `      containers:`,
      `        - name: ${name}`,
      `          image: ${name}:latest`,
      `          ports:`,
      `            - containerPort: 8080`,
      "",
    ].join("\n");
  }
  if (nt === "PostgreSQLDB") {
    return [
      "---",
      `apiVersion: v1`,
      `kind: Pod`,
      `metadata:`,
      `  name: ${name}`,
      `  labels: { app: ${name} }`,
      `spec:`,
      `  containers:`,
      `    - name: ${name}`,
      `      image: postgres:16`,
      `      ports:`,
      `        - containerPort: 5432`,
      "",
    ].join("\n");
  }
  if (nt === "MySQLDB") {
    return [
      "---",
      `apiVersion: v1`,
      `kind: Pod`,
      `metadata:`,
      `  name: ${name}`,
      `  labels: { app: ${name} }`,
      `spec:`,
      `  containers:`,
      `    - name: ${name}`,
      `      image: mysql:8`,
      `      ports:`,
      `        - containerPort: 3306`,
      "",
    ].join("\n");
  }
  if (nt === "MessageQueue") {
    return [
      "---",
      `apiVersion: v1`,
      `kind: Pod`,
      `metadata:`,
      `  name: ${name}`,
      `  labels: { app: ${name} }`,
      `spec:`,
      `  containers:`,
      `    - name: ${name}`,
      `      image: rabbitmq:3-management`,
      `      ports:`,
      `        - containerPort: 5672`,
      "",
    ].join("\n");
  }
  return "";
}

function genCfnNode(nt: NodeType, cfg: NodeConfig, label: string, name: string, idx: number): string[] {
  const lines: string[] = [];
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    lines.push(`    LoadBalancer${idx}:`);
    lines.push(`      Type: AWS::ElasticLoadBalancingV2::LoadBalancer`);
    lines.push(`      Properties:`);
    lines.push(`        Name: ${label}`);
    lines.push(`        Scheme: ${cfg.security.isPublicFacing ? "internet-facing" : "internal"}`);
    lines.push(`        Type: ${nt === "APIGateway" ? "application" : "network"}`);
  } else if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    lines.push(`    Server${idx}:`);
    lines.push(`      Type: AWS::EC2::Instance`);
    lines.push(`      Properties:`);
    lines.push(`        InstanceType: t3.medium`);
    lines.push(`        Monitoring: true`);
  } else if (nt === "PostgreSQLDB" || nt === "MySQLDB") {
    lines.push(`    Database${idx}:`);
    lines.push(`      Type: AWS::RDS::DBInstance`);
    lines.push(`      Properties:`);
    lines.push(`        DBInstanceIdentifier: ${name}`);
    lines.push(`        Engine: ${nt === "PostgreSQLDB" ? "postgres" : "mysql"}`);
    lines.push(`        DBInstanceClass: db.t3.medium`);
    lines.push(`        AllocatedStorage: 20`);
  } else if (nt === "Redis") {
    lines.push(`    Cache${idx}:`);
    lines.push(`      Type: AWS::ElastiCache::CacheCluster`);
    lines.push(`      Properties:`);
    lines.push(`        ClusterName: ${name}`);
    lines.push(`        Engine: redis`);
    lines.push(`        CacheNodeType: cache.t3.micro`);
    lines.push(`        NumCacheNodes: 1`);
  } else if (nt === "MessageQueue") {
    lines.push(`    Queue${idx}:`);
    lines.push(`      Type: AWS::SQS::Queue`);
    lines.push(`      Properties:`);
    lines.push(`        QueueName: ${name}`);
  } else if (nt === "CDN") {
    lines.push(`    CDN${idx}:`);
    lines.push(`      Type: AWS::CloudFront::Distribution`);
    lines.push(`      Properties:`);
    lines.push(`        DistributionConfig:`);
    lines.push(`          Enabled: true`);
  } else if (nt === "ServerlessFunction") {
    lines.push(`    Function${idx}:`);
    lines.push(`      Type: AWS::Lambda::Function`);
    lines.push(`      Properties:`);
    lines.push(`        FunctionName: ${name}`);
    lines.push(`        Runtime: nodejs20.x`);
    lines.push(`        Handler: index.handler`);
  } else if (nt === "VPC") {
    lines.push(`    VPC${idx}:`);
    lines.push(`      Type: AWS::EC2::VPC`);
    lines.push(`      Properties:`);
    lines.push(`        CidrBlock: 10.0.0.0/16`);
  }
  return lines;
}

export function exportTerraform(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "# Terraform configuration",
    "",
    'terraform {',
    '  required_providers {',
    '    aws = { source = "hashicorp/aws", version = "~> 5.0" }',
    "  }",
    "}",
    "",
    'provider "aws" {',
    '  region = "us-east-1"',
    "}",
    "",
  ];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    lines.push(genTerraformNode(nt, cfg, label, resourceName(label)));
  }
  return lines.join("\n");
}

export function exportKubernetes(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "# Kubernetes manifests",
    "",
  ];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    lines.push(genK8sNode(nt, cfg, label, resourceName(label)));
  }
  return lines.join("\n");
}

export function exportCloudFormation(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "AWSTemplateFormatVersion: 2010-09-09",
    "Description: Infrastructure generated by Live System Design Platform",
    "Resources:",
  ];
  let idx = 1;
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    const resourceLines = genCfnNode(nt, cfg, label, resourceName(label), idx);
    lines.push(...resourceLines);
    idx++;
  }
  return lines.join("\n");
}
