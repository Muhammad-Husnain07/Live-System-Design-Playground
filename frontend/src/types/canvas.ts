import type { Node, Edge } from "reactflow";
import type { LucideIcon } from "lucide-react";

export const NodeCategory = {
  Infrastructure: "infrastructure",
  Data: "data",
  Network: "network",
  Messaging: "messaging",
  Compute: "compute",
  External: "external",
} as const;

export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

export type NodeType =
  | "LoadBalancer"
  | "APIGateway"
  | "WebServer"
  | "AppServer"
  | "Microservice"
  | "PostgreSQLDB"
  | "MySQLDB"
  | "MongoDB"
  | "Redis"
  | "Elasticsearch"
  | "CDN"
  | "DNS"
  | "Firewall"
  | "VPC"
  | "Subnet"
  | "MessageQueue"
  | "EventBus"
  | "PubSub"
  | "ContainerCluster"
  | "ServerlessFunction"
  | "BatchProcessor"
  | "WorkerService"
  | "ExternalClient"
  | "ThirdPartyAPI"
  | "MobileClient"
  | "WebBrowser";

export interface DeploymentConfig {
  strategy: "rolling" | "blue_green" | "canary";
  canaryPercent: number;
  canaryVersion: string;
  isCanaryActive: boolean;
  canaryFailed?: boolean;
  blueGreenGroup?: string;
  activeGroup?: string;
}

export interface SecurityConfig {
  isPublicFacing: boolean;
  requiresTLS: boolean;
  allowedInbound: string[];
  vpcId: string;
}

export interface NodeConfig {
  instances: number;
  region: string;
  maxRPS: number;
  latencyMs: number;
  errorRate: number;
  isFailed: boolean;
  isBottleneck: boolean;
  deployment: DeploymentConfig;
  security: SecurityConfig;
}

export interface NodeMetrics {
  currentRPS: number;
  cpuPercent: number;
  memoryPercent: number;
  queueDepth: number;
  errorCount: number;
  p99LatencyMs: number;
  canaryRPS: number;
  errorRate: number;
}

export interface SimulationNodeState {
  status: "healthy" | "degraded" | "failing" | "down";
  uptimeSeconds: number;
  lastFailure: string | null;
  failureCount: number;
}

export interface EdgeRoutingConfig {
  protocol: "HTTP" | "gRPC" | "TCP" | "WebSocket" | "AMQP";
  isSync: boolean;
  trafficPercent: number;
  requiresTLS: boolean;
}

export interface NodeMetadata {
  label: string;
  description: string;
  defaultConfig: Record<string, any>;
  icon: LucideIcon;
  color: string;
  category: NodeCategory;
}

export type CanvasNode = Node<{
  nodeType: NodeType;
  label: string;
  config: NodeConfig;
  simulationState: SimulationNodeState;
  metrics: NodeMetrics;
}>;

export type CanvasEdge = Edge<{
  routing: EdgeRoutingConfig;
  throughputRPS: number;
  latencyMs: number;
  isAnimated: boolean;
  isSaturated: boolean;
  isSecure: boolean;
}>;

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
}
