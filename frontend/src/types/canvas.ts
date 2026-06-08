import type { Node, Edge } from "reactflow";
import type { LucideIcon } from "lucide-react";

export const NodeCategory = {
  Infrastructure: "infrastructure",
  Data: "data",
  Network: "network",
  Messaging: "messaging",
  Compute: "compute",
  External: "external",
  AIML: "ai/ml",
  ModernCompute: "modern-compute",
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
  | "WebBrowser"
  | "VectorDB"
  | "LLMNode"
  | "GPUCluster"
  | "EdgeCompute"
  | "ServerlessV2";

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

export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPUPercent: number;
  targetMemPercent: number;
  cooldownTicks: number;
  scaleUpFactor: number;
  scaleDownFactor: number;
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
  cacheHitRatio: number;
  connectionPoolMax: number;
  coldStartMs: number;
  diskIOPSMax: number;
  isPrimaryDB: boolean;
  autoScaling: AutoScalingConfig;
  replicationRole: string;
  replicationLagMs: number;
  computeTier: "on_demand" | "reserved" | "spot";
  permissions: string;
  // AI/ML fields
  dimensions: number;
  indexType: string;
  topK: number;
  tokensPerSecond: number;
  promptTokenCount: number;
  completionTokenCount: number;
  vramGB: number;
  modelSizeGB: number;
  cudaUtilization: number;
  geographicLatencyModifier: number;
  snapStartEnabled: boolean;
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
  retryCount: number;
  droppedRequests: number;
  cacheHitRatio: number;
  connectionPoolMax: number;
  coldStartMs: number;
  diskIOPSMax: number;
  isPrimaryDB: boolean;
  activeConnections: number;
  desiredInstances: number;
  scalingEvent: string;
  staleReadCount: number;
  isSplitBrain: boolean;
  dataInconsistency: number;
  spotInterrupted: boolean;
  // AI/ML metrics
  dimensions: number;
  indexType: string;
  topK: number;
  tokensPerSecond: number;
  promptTokenCount: number;
  completionTokenCount: number;
  vramGB: number;
  modelSizeGB: number;
  cudaUtilization: number;
  geographicLatencyModifier: number;
  snapStartEnabled: boolean;
}

export interface SimulationNodeState {
  status: "healthy" | "degraded" | "failing" | "down";
  uptimeSeconds: number;
  lastFailure: string | null;
  failureCount: number;
}

export interface EdgeRoutingConfig {
  protocol: "HTTP" | "gRPC" | "TCP" | "WebSocket" | "AMQP" | "Replication";
  isSync: boolean;
  trafficPercent: number;
  requiresTLS: boolean;
  authRequired: boolean;
  packetLoss: number;
  jitterMs: number;
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
