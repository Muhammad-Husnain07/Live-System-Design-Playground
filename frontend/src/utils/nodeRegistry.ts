import {
  Scale, DoorOpen, Globe, Settings, Puzzle, Database, Leaf, Circle, Search,
  Satellite, Shield, Box, Square, Inbox, Bus, Megaphone, Container, Zap,
  ClipboardList, Wrench, Link, Smartphone, Monitor,
} from "lucide-react";
import { NodeCategory } from "../types/canvas";
import type { NodeType, NodeMetadata } from "../types/canvas";

const base = {
  isFailed: false,
  isBottleneck: false,
  deployment: { strategy: "rolling" as const, canaryPercent: 0, canaryVersion: "", isCanaryActive: false },
  security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [] as string[], vpcId: "" },
};

type Override = Partial<typeof base> & { instances: number; maxRPS: number; latencyMs: number };

const infra = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.01, ...overrides });
const data = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.001, ...overrides });
const network = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.001, ...overrides });
const messaging = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.005, ...overrides });
const compute = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.01, ...overrides });
const external = (overrides: Override) => ({ ...base, region: "us-east-1", errorRate: 0.001, ...overrides });

export const NODE_REGISTRY: Record<NodeType, NodeMetadata> = {
  LoadBalancer: {
    label: "Load Balancer",
    description: "Distributes incoming traffic across multiple targets",
    icon: Scale,
    color: "#3B82F6",
    category: NodeCategory.Infrastructure,
    defaultConfig: infra({ instances: 2, maxRPS: 10000, latencyMs: 5, security: { isPublicFacing: true, requiresTLS: true, allowedInbound: [], vpcId: "" } }),
  },
  APIGateway: {
    label: "API Gateway",
    description: "Unified entry point for API requests with auth and rate limiting",
    icon: DoorOpen,
    color: "#3B82F6",
    category: NodeCategory.Infrastructure,
    defaultConfig: infra({ instances: 2, maxRPS: 5000, latencyMs: 10, security: { isPublicFacing: true, requiresTLS: true, allowedInbound: [], vpcId: "" } }),
  },
  WebServer: {
    label: "Web Server",
    description: "Serves HTTP content and static assets",
    icon: Globe,
    color: "#3B82F6",
    category: NodeCategory.Infrastructure,
    defaultConfig: infra({ instances: 3, maxRPS: 2000, latencyMs: 20 }),
  },
  AppServer: {
    label: "Application Server",
    description: "Executes business logic and server-side processing",
    icon: Settings,
    color: "#3B82F6",
    category: NodeCategory.Infrastructure,
    defaultConfig: infra({ instances: 3, maxRPS: 2000, latencyMs: 30 }),
  },
  Microservice: {
    label: "Microservice",
    description: "Independently deployable service with bounded context",
    icon: Puzzle,
    color: "#3B82F6",
    category: NodeCategory.Infrastructure,
    defaultConfig: infra({ instances: 3, maxRPS: 1500, latencyMs: 25 }),
  },

  PostgreSQLDB: {
    label: "PostgreSQL",
    description: "Relational database with ACID transactions and advanced indexing",
    icon: Database,
    color: "#F97316",
    category: NodeCategory.Data,
    defaultConfig: data({ instances: 1, maxRPS: 1000, latencyMs: 50 }),
  },
  MySQLDB: {
    label: "MySQL",
    description: "Popular open-source relational database",
    icon: Database,
    color: "#F97316",
    category: NodeCategory.Data,
    defaultConfig: data({ instances: 1, maxRPS: 1000, latencyMs: 50 }),
  },
  MongoDB: {
    label: "MongoDB",
    description: "NoSQL document database with flexible schemas",
    icon: Leaf,
    color: "#F97316",
    category: NodeCategory.Data,
    defaultConfig: data({ instances: 1, maxRPS: 2000, latencyMs: 30 }),
  },
  Redis: {
    label: "Redis",
    description: "In-memory data store for caching and real-time workloads",
    icon: Circle,
    color: "#F97316",
    category: NodeCategory.Data,
    defaultConfig: data({ instances: 2, maxRPS: 10000, latencyMs: 5 }),
  },
  Elasticsearch: {
    label: "Elasticsearch",
    description: "Distributed search and analytics engine",
    icon: Search,
    color: "#F97316",
    category: NodeCategory.Data,
    defaultConfig: data({ instances: 3, maxRPS: 3000, latencyMs: 30 }),
  },

  CDN: {
    label: "CDN",
    description: "Content delivery network for low-latency asset distribution",
    icon: Globe,
    color: "#A855F7",
    category: NodeCategory.Network,
    defaultConfig: network({ instances: 1, maxRPS: 50000, latencyMs: 2 }),
  },
  DNS: {
    label: "DNS",
    description: "Domain name resolution service",
    icon: Satellite,
    color: "#A855F7",
    category: NodeCategory.Network,
    defaultConfig: network({ instances: 1, maxRPS: 50000, latencyMs: 2 }),
  },
  Firewall: {
    label: "Firewall",
    description: "Network security gateway filtering inbound and outbound traffic",
    icon: Shield,
    color: "#A855F7",
    category: NodeCategory.Network,
    defaultConfig: network({ instances: 2, maxRPS: 20000, latencyMs: 5 }),
  },
  VPC: {
    label: "VPC",
    description: "Virtual private cloud network boundary",
    icon: Box,
    color: "#A855F7",
    category: NodeCategory.Network,
    defaultConfig: network({ instances: 0, maxRPS: 0, latencyMs: 1 }),
  },
  Subnet: {
    label: "Subnet",
    description: "Logical subdivision of a VPC network",
    icon: Square,
    color: "#A855F7",
    category: NodeCategory.Network,
    defaultConfig: network({ instances: 0, maxRPS: 0, latencyMs: 1 }),
  },

  MessageQueue: {
    label: "Message Queue",
    description: "Buffers and delivers messages between services asynchronously",
    icon: Inbox,
    color: "#06B6D4",
    category: NodeCategory.Messaging,
    defaultConfig: messaging({ instances: 3, maxRPS: 10000, latencyMs: 15 }),
  },
  EventBus: {
    label: "Event Bus",
    description: "Publish/subscribe event routing backbone",
    icon: Bus,
    color: "#06B6D4",
    category: NodeCategory.Messaging,
    defaultConfig: messaging({ instances: 3, maxRPS: 15000, latencyMs: 10 }),
  },
  PubSub: {
    label: "Pub/Sub",
    description: "Topic-based message distribution system",
    icon: Megaphone,
    color: "#06B6D4",
    category: NodeCategory.Messaging,
    defaultConfig: messaging({ instances: 3, maxRPS: 20000, latencyMs: 8 }),
  },

  ContainerCluster: {
    label: "Container Cluster",
    description: "Orchestrated container environment (e.g. Kubernetes)",
    icon: Container,
    color: "#22C55E",
    category: NodeCategory.Compute,
    defaultConfig: compute({ instances: 5, maxRPS: 5000, latencyMs: 15 }),
  },
  ServerlessFunction: {
    label: "Serverless Function",
    description: "Event-driven function-as-a-service compute unit",
    icon: Zap,
    color: "#22C55E",
    category: NodeCategory.Compute,
    defaultConfig: compute({ instances: 10, maxRPS: 1000, latencyMs: 100 }),
  },
  BatchProcessor: {
    label: "Batch Processor",
    description: "Processes large volumes of data in scheduled jobs",
    icon: ClipboardList,
    color: "#22C55E",
    category: NodeCategory.Compute,
    defaultConfig: compute({ instances: 2, maxRPS: 500, latencyMs: 5000 }),
  },
  WorkerService: {
    label: "Worker Service",
    description: "Background task consumer processing queue messages",
    icon: Wrench,
    color: "#22C55E",
    category: NodeCategory.Compute,
    defaultConfig: compute({ instances: 4, maxRPS: 3000, latencyMs: 50 }),
  },

  ExternalClient: {
    label: "External Client",
    description: "Generic external system initiating requests",
    icon: Globe,
    color: "#6B7280",
    category: NodeCategory.External,
    defaultConfig: external({ instances: 0, maxRPS: 1000, latencyMs: 100 }),
  },
  ThirdPartyAPI: {
    label: "Third-Party API",
    description: "External service consumed by the architecture",
    icon: Link,
    color: "#6B7280",
    category: NodeCategory.External,
    defaultConfig: external({ instances: 0, maxRPS: 500, latencyMs: 200 }),
  },
  MobileClient: {
    label: "Mobile Client",
    description: "Native mobile application making API requests",
    icon: Smartphone,
    color: "#6B7280",
    category: NodeCategory.External,
    defaultConfig: external({ instances: 0, maxRPS: 2000, latencyMs: 150 }),
  },
  WebBrowser: {
    label: "Web Browser",
    description: "Browser-based client accessing the application",
    icon: Monitor,
    color: "#6B7280",
    category: NodeCategory.External,
    defaultConfig: external({ instances: 0, maxRPS: 3000, latencyMs: 100 }),
  },
};
