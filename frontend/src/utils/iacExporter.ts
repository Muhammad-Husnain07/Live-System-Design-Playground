import type { NodeType, NodeConfig } from "../types/canvas";
import { useCanvasStore } from "../store/canvasStore";

function getNodes() {
  return useCanvasStore.getState().nodes;
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

function genTerraformGCPNode(nt: NodeType, _cfg: NodeConfig, label: string, name: string): string {
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    return [
      `resource "google_compute_forwarding_rule" "${name}" {`,
      `  name       = "${name}"`,
      `  target     = google_compute_target_pool.${name}.id`,
      `  port_range = "80"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    return [
      `resource "google_compute_instance" "${name}" {`,
      `  name         = "${name}"`,
      `  machine_type = "e2-medium"`,
      `  zone         = "us-central1-a"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "PostgreSQLDB") {
    return [
      `resource "google_sql_database_instance" "${name}" {`,
      `  name             = "${name}"`,
      `  database_version = "POSTGRES_16"`,
      `  settings { tier = "db-custom-1-3840" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MySQLDB") {
    return [
      `resource "google_sql_database_instance" "${name}" {`,
      `  name             = "${name}"`,
      `  database_version = "MYSQL_8_0"`,
      `  settings { tier = "db-custom-1-3840" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Redis") {
    return [
      `resource "google_redis_instance" "${name}" {`,
      `  name           = "${name}"`,
      `  memory_size_gb = 1`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MongoDB" || nt === "Elasticsearch") {
    return [
      `resource "google_compute_instance" "${name}" {`,
      `  name         = "${name}"`,
      `  machine_type = "e2-standard-2"`,
      `  zone         = "us-central1-a"`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "CDN") {
    return [
      `resource "google_compute_url_map" "${name}" {`,
      `  name            = "${name}"`,
      `  default_service = google_compute_backend_bucket.${name}.id`,
      "}\n",
    ].join("\n");
  }
  if (nt === "DNS") {
    return [
      `resource "google_dns_managed_zone" "${name}" {`,
      `  name     = "${name}"`,
      `  dns_name = "${label}.example.com."`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Firewall") {
    return [
      `resource "google_compute_firewall" "${name}" {`,
      `  name    = "${name}"`,
      `  network = "default"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MessageQueue") {
    return [
      `resource "google_pubsub_topic" "${name}" {`,
      `  name = "${name}"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "EventBus" || nt === "PubSub") {
    return [
      `resource "google_pubsub_topic" "${name}" {`,
      `  name = "${name}"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ContainerCluster") {
    return [
      `resource "google_container_cluster" "${name}" {`,
      `  name     = "${name}"`,
      `  location = "us-central1"`,
      `  initial_node_count = 1`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ServerlessFunction") {
    return [
      `resource "google_cloudfunctions_function" "${name}" {`,
      `  name        = "${name}"`,
      `  runtime     = "nodejs20"`,
      `  entry_point = "handler"`,
      `  trigger_http = true`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ServerlessV2") {
    return [
      `resource "google_cloudfunctions2_function" "${name}" {`,
      `  name    = "${name}"`,
      `  location = "us-central1"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "VPC") {
    return [
      `resource "google_compute_network" "${name}" {`,
      `  name = "${name}"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Subnet") {
    return [
      `resource "google_compute_subnetwork" "${name}" {`,
      `  name          = "${name}"`,
      `  network       = google_compute_network.default.id`,
      `  ip_cidr_range = "10.0.1.0/24"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "GPUCluster") {
    return [
      `resource "google_compute_instance" "${name}" {`,
      `  name         = "${name}"`,
      `  machine_type = "a2-highgpu-1g"`,
      `  zone         = "us-central1-a"`,
      `  guest_accelerator { type = "nvidia-tesla-a100" count = 1 }`,
      `  tags = { Name = "${label}" }`,
      "}\n",
    ].join("\n");
  }
  return "";
}

function genTerraformAzureNode(nt: NodeType, _cfg: NodeConfig, _label: string, name: string): string {
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    return [
      `resource "azurerm_lb" "${name}" {`,
      `  name                = "${name}"`,
      `  location            = "eastus"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      "}\n",
    ].join("\n");
  }
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    return [
      `resource "azurerm_linux_virtual_machine" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  size                = "Standard_D2s_v3"`,
      `  admin_username      = "adminuser"`,
      `  network_interface_ids = [azurerm_network_interface.${name}.id]`,
      "}\n",
    ].join("\n");
  }
  if (nt === "PostgreSQLDB") {
    return [
      `resource "azurerm_postgresql_flexible_server" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  sku_name            = "B_Standard_B1ms"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MySQLDB") {
    return [
      `resource "azurerm_mysql_flexible_server" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  sku_name            = "B_Standard_B1ms"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Redis") {
    return [
      `resource "azurerm_redis_cache" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  capacity            = 1`,
      `  family              = "C"`,
      `  sku_name            = "Basic"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MongoDB") {
    return [
      `resource "azurerm_cosmosdb_account" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  offer_type          = "Standard"`,
      `  kind                = "MongoDB"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Elasticsearch") {
    return [
      `resource "azurerm_elastic_cloud_elasticsearch" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "CDN") {
    return [
      `resource "azurerm_cdn_frontdoor_profile" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      "}\n",
    ].join("\n");
  }
  if (nt === "DNS") {
    return [
      `resource "azurerm_dns_zone" "${name}" {`,
      `  name                = "${name}.example.com"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Firewall") {
    return [
      `resource "azurerm_network_security_group" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "MessageQueue") {
    return [
      `resource "azurerm_servicebus_queue" "${name}" {`,
      `  name         = "${name}"`,
      `  namespace_id = azurerm_servicebus_namespace.main.id`,
      "}\n",
    ].join("\n");
  }
  if (nt === "EventBus" || nt === "PubSub") {
    return [
      `resource "azurerm_eventgrid_topic" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ContainerCluster") {
    return [
      `resource "azurerm_kubernetes_cluster" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  dns_prefix          = "${name}"`,
      `  default_node_pool { name = "default" node_count = 1 vm_size = "Standard_D2s_v3" }`,
      "}\n",
    ].join("\n");
  }
  if (nt === "ServerlessFunction") {
    return [
      `resource "azurerm_linux_function_app" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  service_plan_id     = azurerm_service_plan.main.id`,
      "}\n",
    ].join("\n");
  }
  if (nt === "VPC") {
    return [
      `resource "azurerm_virtual_network" "${name}" {`,
      `  name                = "${name}"`,
      `  resource_group_name = azurerm_resource_group.main.name`,
      `  location            = "eastus"`,
      `  address_space       = ["10.0.0.0/16"]`,
      "}\n",
    ].join("\n");
  }
  if (nt === "Subnet") {
    return [
      `resource "azurerm_subnet" "${name}" {`,
      `  name                 = "${name}"`,
      `  resource_group_name  = azurerm_resource_group.main.name`,
      `  virtual_network_name = azurerm_virtual_network.default.name`,
      `  address_prefixes     = ["10.0.1.0/24"]`,
      "}\n",
    ].join("\n");
  }
  return "";
}

function genDeploymentManagerNode(nt: NodeType, _cfg: NodeConfig, label: string, name: string): string[] {
  const lines: string[] = [];
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.instance`);
    lines.push(`  properties:`);
    lines.push(`    zone: us-central1-a`);
    lines.push(`    machineType: zones/us-central1-a/machineTypes/e2-medium`);
    lines.push(`    tags: { items: ["${label}"] }`);
  } else if (nt === "PostgreSQLDB") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: sqladmin.v1beta4.instance`);
    lines.push(`  properties:`);
    lines.push(`    databaseVersion: POSTGRES_16`);
    lines.push(`    settings: { tier: db-custom-1-3840 }`);
  } else if (nt === "MySQLDB") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: sqladmin.v1beta4.instance`);
    lines.push(`  properties:`);
    lines.push(`    databaseVersion: MYSQL_8_0`);
    lines.push(`    settings: { tier: db-custom-1-3840 }`);
  } else if (nt === "Redis") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: redis.v1.instance`);
    lines.push(`  properties:`);
    lines.push(`    memorySizeGb: 1`);
    lines.push(`    tier: BASIC`);
  } else if (nt === "LoadBalancer" || nt === "APIGateway") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.forwardingRule`);
    lines.push(`  properties:`);
    lines.push(`    portRange: 80`);
  } else if (nt === "CDN") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.urlMap`);
    lines.push(`  properties:`);
    lines.push(`    defaultService: https://www.googleapis.com/compute/v1/projects/{{ params[project-id] }}/global/backendBuckets/${name}`);
  } else if (nt === "DNS") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: dns.v1.managedZone`);
    lines.push(`  properties:`);
    lines.push(`    dnsName: ${label}.example.com.`);
  } else if (nt === "Firewall") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.firewall`);
    lines.push(`  properties:`);
    lines.push(`    network: https://www.googleapis.com/compute/v1/projects/{{ params[project-id] }}/global/networks/default`);
  } else if (nt === "MessageQueue" || nt === "EventBus" || nt === "PubSub") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: pubsub.v1.topic`);
    lines.push(`  properties:`);
    lines.push(`    name: ${name}`);
  } else if (nt === "ContainerCluster") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: container.v1.cluster`);
    lines.push(`  properties:`);
    lines.push(`    initialNodeCount: 1`);
    lines.push(`    location: us-central1`);
  } else if (nt === "ServerlessFunction") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: cloudfunctions.v1beta2.function`);
    lines.push(`  properties:`);
    lines.push(`    runtime: nodejs20`);
    lines.push(`    entryPoint: handler`);
    lines.push(`    httpsTrigger: {}`);
  } else if (nt === "VPC") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.network`);
    lines.push(`  properties:`);
    lines.push(`    routingConfig: { routingMode: REGIONAL }`);
  } else if (nt === "Subnet") {
    lines.push(`- name: ${name}`);
    lines.push(`  type: compute.v1.subnetwork`);
    lines.push(`  properties:`);
    lines.push(`    network: https://www.googleapis.com/compute/v1/projects/{{ params[project-id] }}/global/networks/default`);
    lines.push(`    ipCidrRange: 10.0.1.0/24`);
  }
  return lines;
}

function genArmResource(nt: NodeType, _cfg: NodeConfig, label: string, name: string, _idx: number): Record<string, any> | null {
  const baseResource: Record<string, any> = {
    apiVersion: "2023-01-01",
    dependsOn: [],
  };
  if (nt === "WebServer" || nt === "AppServer" || nt === "Microservice") {
    return {
      ...baseResource,
      type: "Microsoft.Compute/virtualMachines",
      name,
      apiVersion: "2023-03-01",
      location: "[resourceGroup().location]",
      properties: {
        hardwareProfile: { vmSize: "Standard_D2s_v3" },
        storageProfile: { imageReference: { publisher: "Canonical", offer: "0001-com-ubuntu-server-jammy", sku: "22_04-lts", version: "latest" } },
        osProfile: { computerName: name, adminUsername: "adminuser" },
      },
      tags: { Name: label },
    };
  }
  if (nt === "PostgreSQLDB") {
    return {
      ...baseResource,
      type: "Microsoft.DBforPostgreSQL/flexibleServers",
      name,
      apiVersion: "2022-12-01",
      location: "[resourceGroup().location]",
      properties: { version: "16" },
      sku: { name: "Standard_B1ms", tier: "Burstable" },
    };
  }
  if (nt === "MySQLDB") {
    return {
      ...baseResource,
      type: "Microsoft.DBforMySQL/flexibleServers",
      name,
      apiVersion: "2022-01-01",
      location: "[resourceGroup().location]",
      properties: { version: "8.0.21" },
      sku: { name: "Standard_B1ms", tier: "Burstable" },
    };
  }
  if (nt === "Redis") {
    return {
      ...baseResource,
      type: "Microsoft.Cache/redis",
      name,
      apiVersion: "2022-06-01",
      location: "[resourceGroup().location]",
      properties: { sku: { name: "Basic", family: "C", capacity: 1 } },
    };
  }
  if (nt === "MongoDB") {
    return {
      ...baseResource,
      type: "Microsoft.DocumentDB/databaseAccounts",
      name,
      apiVersion: "2023-04-15",
      location: "[resourceGroup().location]",
      kind: "MongoDB",
      properties: { databaseAccountOfferType: "Standard" },
    };
  }
  if (nt === "LoadBalancer" || nt === "APIGateway") {
    return {
      ...baseResource,
      type: "Microsoft.Network/loadBalancers",
      name,
      apiVersion: "2023-02-01",
      location: "[resourceGroup().location]",
      properties: { frontendIPConfigurations: [{ name: "frontend", properties: { privateIPAllocationMethod: "Dynamic" } }] },
    };
  }
  if (nt === "CDN") {
    return {
      ...baseResource,
      type: "Microsoft.Cdn/profiles",
      name,
      apiVersion: "2023-05-01",
      location: "global",
      sku: { name: "Standard_Microsoft" },
    };
  }
  if (nt === "DNS") {
    return {
      ...baseResource,
      type: "Microsoft.Network/dnsZones",
      name: `${name}.example.com`,
      apiVersion: "2018-05-01",
      location: "global",
    };
  }
  if (nt === "Firewall") {
    return {
      ...baseResource,
      type: "Microsoft.Network/networkSecurityGroups",
      name,
      apiVersion: "2023-02-01",
      location: "[resourceGroup().location]",
      properties: { securityRules: [] },
    };
  }
  if (nt === "MessageQueue") {
    return {
      ...baseResource,
      type: "Microsoft.ServiceBus/namespaces/queues",
      name: `sb-${name}/${name}`,
      apiVersion: "2022-10-01-preview",
      dependsOn: [`Microsoft.ServiceBus/namespaces/sb-${name}`],
    };
  }
  if (nt === "EventBus" || nt === "PubSub") {
    return {
      ...baseResource,
      type: "Microsoft.EventGrid/topics",
      name,
      apiVersion: "2022-06-15",
      location: "[resourceGroup().location]",
    };
  }
  if (nt === "ContainerCluster") {
    return {
      ...baseResource,
      type: "Microsoft.ContainerService/managedClusters",
      name,
      apiVersion: "2023-04-01",
      location: "[resourceGroup().location]",
      properties: {
        dnsPrefix: name,
        agentPoolProfiles: [{ name: "default", count: 1, vmSize: "Standard_D2s_v3" }],
      },
    };
  }
  if (nt === "ServerlessFunction") {
    return {
      ...baseResource,
      type: "Microsoft.Web/sites",
      name,
      apiVersion: "2022-09-01",
      location: "[resourceGroup().location]",
      kind: "functionapp,linux",
      properties: { serverFarmId: `[resourceId('Microsoft.Web/serverfarms', 'plan-${name}')]` },
    };
  }
  if (nt === "VPC") {
    return {
      ...baseResource,
      type: "Microsoft.Network/virtualNetworks",
      name,
      apiVersion: "2023-02-01",
      location: "[resourceGroup().location]",
      properties: { addressSpace: { addressPrefixes: ["10.0.0.0/16"] } },
    };
  }
  if (nt === "Subnet") {
    return {
      ...baseResource,
      type: "Microsoft.Network/virtualNetworks/subnets",
      name: `vnet-default/${name}`,
      apiVersion: "2023-02-01",
      dependsOn: [`Microsoft.Network/virtualNetworks/vnet-default`],
      properties: { addressPrefix: "10.0.1.0/24" },
    };
  }
  return null;
}

function genK8sNode(nt: NodeType, cfg: NodeConfig, _label: string, name: string): string {
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

export function exportTerraformGCP(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "# Terraform GCP configuration",
    "",
    'terraform {',
    '  required_providers {',
    '    google = { source = "hashicorp/google", version = "~> 5.0" }',
    "  }",
    "}",
    "",
    'provider "google" {',
    '  project = "my-gcp-project"',
    '  region  = "us-central1"',
    "}",
    "",
  ];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    lines.push(genTerraformGCPNode(nt, cfg, label, resourceName(label)));
  }
  return lines.join("\n");
}

export function exportTerraformAzure(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "# Terraform Azure configuration",
    "",
    'terraform {',
    '  required_providers {',
    '    azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" }',
    "  }",
    "}",
    "",
    'provider "azurerm" {',
    '  features {}',
    "}",
    "",
    'resource "azurerm_resource_group" "main" {',
    '  name     = "rg-live-design"',
    '  location = "eastus"',
    "}",
    "",
  ];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    lines.push(genTerraformAzureNode(nt, cfg, label, resourceName(label)));
  }
  return lines.join("\n");
}

export function exportDeploymentManager(): string {
  const nodes = getNodes();
  const lines: string[] = [
    "# Generated by Live System Design Platform",
    "# Deployment Manager YAML",
    "",
    "imports:",
    "- path: templates.jinja",
    "",
    "resources:",
  ];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    const resLines = genDeploymentManagerNode(nt, cfg, label, resourceName(label));
    lines.push(...resLines);
  }
  return lines.join("\n");
}

export function exportArm(): string {
  const nodes = getNodes();
  const resources: Record<string, any>[] = [];
  for (const node of nodes) {
    const nt = node.data?.nodeType as NodeType | undefined;
    const cfg: NodeConfig | undefined = node.data?.config;
    const label = node.data?.label ?? node.id;
    if (!cfg || !nt) continue;
    const res = genArmResource(nt, cfg, label, resourceName(label), 0);
    if (res) resources.push(res);
  }
  const template = {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    parameters: {},
    resources,
  };
  return JSON.stringify(template, null, 2);
}
