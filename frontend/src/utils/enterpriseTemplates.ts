import type { Node, Edge } from "reactflow";
import type { NodeType, NodeMetrics, SimulationNodeState, EdgeRoutingConfig } from "../types/canvas";
import { NODE_REGISTRY } from "./nodeRegistry";
import { getReactFlowType } from "../components/canvas/nodeTypes";
import { Film, Car, ShoppingCart, Zap, MessageSquareText, GitBranch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const DEFAULT_SIM: SimulationNodeState = {
  status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0,
};

export const DEFAULT_METRICS: NodeMetrics = {
  currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0,
  errorCount: 0, p99LatencyMs: 0, canaryRPS: 0, errorRate: 0,
  retryCount: 0, droppedRequests: 0, cacheHitRatio: 0, connectionPoolMax: 100,
  coldStartMs: 500, diskIOPSMax: 3000, isPrimaryDB: false, activeConnections: 0,
  desiredInstances: 0, scalingEvent: "", staleReadCount: 0, isSplitBrain: false,
  dataInconsistency: 0, spotInterrupted: false,
  dimensions: 0, indexType: "", topK: 0,
  tokensPerSecond: 0, promptTokenCount: 0, completionTokenCount: 0,
  vramGB: 0, modelSizeGB: 0, cudaUtilization: 0,
  geographicLatencyModifier: 0, snapStartEnabled: false,
};

export interface TemplateNodePreview {
  label: string;
  type: string;
}

export interface TemplateEdgePreview {
  from: string;
  to: string;
  protocol: string;
}

export interface EnterpriseTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  industry: string;
  scale: string;
  tags: string[];
  totalInstances: number;
  peakRPS: number;
  nodePreview: TemplateNodePreview[];
  edgePreview: TemplateEdgePreview[];
  build: (ox: number, oy: number) => { nodes: Node[]; edges: Edge[] };
}

function n(t: NodeType, l: string, x: number, y: number, cfg: Record<string, any>, ox: number, oy: number): Node {
  return {
    id: `${t}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    type: getReactFlowType(t),
    position: { x: ox + x, y: oy + y },
    style: { width: 220, height: 120 },
    data: { nodeType: t, label: l, config: { ...NODE_REGISTRY[t].defaultConfig, ...cfg }, simulationState: DEFAULT_SIM, metrics: DEFAULT_METRICS },
  } as Node;
}

function e(src: Node, tgt: Node, p: EdgeRoutingConfig["protocol"], sync: boolean, tp: number, lat: number, throughput: number, overrides?: Record<string,any>): Edge {
  return {
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    source: src.id, target: tgt.id, type: "default",
    data: { ...overrides, routing: { protocol: p, isSync: sync, trafficPercent: tp, requiresTLS: true, authRequired: false, packetLoss: 0, jitterMs: 0, ...overrides?.routing }, throughputRPS: throughput, latencyMs: lat, isAnimated: true, isSaturated: false, isSecure: true },
  } as Edge;
}

export const ENTERPRISE_TEMPLATES: EnterpriseTemplate[] = [
  {
    id: "netflix-media", label: "Netflix-Scale Media Delivery", icon: Film,
    desc: "DNS → CDN → APIGW → Auth + Recommend Engine → Kafka → 40 Encoding Workers",
    industry: "Media", scale: "100K RPS", tags: ["Media", "Streaming", "CDN"],
    totalInstances: 154, peakRPS: 100000,
    nodePreview: [
      { label: "Global DNS", type: "DNS" },
      { label: "CDN Edge", type: "CDN" },
      { label: "API Gateway", type: "APIGateway" },
      { label: "Auth Service", type: "AppServer" },
      { label: "Recommend Engine", type: "Microservice" },
      { label: "PostgreSQL", type: "PostgreSQLDB" },
      { label: "MongoDB", type: "MongoDB" },
      { label: "Kafka Event Bus", type: "EventBus" },
      { label: "Encoding Workers", type: "WorkerService" },
    ],
    edgePreview: [
      { from: "Global DNS", to: "CDN Edge", protocol: "HTTP" },
      { from: "CDN Edge", to: "API Gateway", protocol: "HTTP" },
      { from: "API Gateway", to: "Auth Service", protocol: "HTTP" },
      { from: "API Gateway", to: "Recommend Engine", protocol: "HTTP" },
      { from: "Auth Service", to: "PostgreSQL", protocol: "TCP" },
      { from: "Recommend Engine", to: "MongoDB", protocol: "TCP" },
      { from: "Recommend Engine", to: "Kafka Event Bus", protocol: "AMQP" },
      { from: "Kafka Event Bus", to: "Encoding Workers", protocol: "AMQP" },
    ],
    build: (ox, oy) => {
      const [dns, cdn, apigw, auth, rec, pg, mongo, kafka, workers] = [
        n("DNS","Global DNS",0,60,{instances:1,maxRPS:100000,latencyMs:2,region:"us-east-1"},ox,oy),
        n("CDN","CDN Edge",280,60,{instances:50,maxRPS:100000,latencyMs:3,cacheHitRatio:0.9,region:"us-east-1"},ox,oy),
        n("APIGateway","API Gateway",560,60,{instances:8,maxRPS:50000,latencyMs:10,region:"us-east-1",security:{isPublicFacing:true,requiresTLS:true,allowedInbound:["0.0.0.0/0"],vpcId:"vpc-app"},deployment:{strategy:"canary",canaryPercent:5,canaryVersion:"v2.1.0",isCanaryActive:true}},ox,oy),
        n("AppServer","Auth Service",840,-60,{instances:12,maxRPS:8000,latencyMs:25,region:"us-east-1",deployment:{strategy:"rolling",canaryPercent:0,canaryVersion:"",isCanaryActive:false},autoScaling:{enabled:true,minInstances:6,maxInstances:20,targetCPUPercent:70,targetMemPercent:80,cooldownTicks:3,scaleUpFactor:2,scaleDownFactor:0.5}},ox,oy),
        n("Microservice","Recommend Engine",840,140,{instances:25,maxRPS:6000,latencyMs:30,region:"us-east-1",autoScaling:{enabled:true,minInstances:10,maxInstances:50,targetCPUPercent:75,targetMemPercent:85,cooldownTicks:5,scaleUpFactor:1.5,scaleDownFactor:0.5}},ox,oy),
        n("PostgreSQLDB","PostgreSQL",1120,-60,{instances:3,maxRPS:3000,latencyMs:20,region:"us-east-1",isPrimaryDB:true,replicationRole:"primary"},ox,oy),
        n("MongoDB","MongoDB",1120,140,{instances:6,maxRPS:10000,latencyMs:15,region:"us-east-1",replicationRole:"primary"},ox,oy),
        n("EventBus","Kafka Event Bus",1120,340,{instances:9,maxRPS:50000,latencyMs:5,region:"us-east-1"},ox,oy),
        n("WorkerService","Encoding Workers",1400,340,{instances:40,maxRPS:2000,latencyMs:200,region:"us-east-1",autoScaling:{enabled:true,minInstances:10,maxInstances:100,targetCPUPercent:80,targetMemPercent:90,cooldownTicks:3,scaleUpFactor:2,scaleDownFactor:0.5}},ox,oy),
      ];
      return {
        nodes: [dns, cdn, apigw, auth, rec, pg, mongo, kafka, workers],
        edges: [
          e(dns, cdn, "HTTP", true, 100, 2, 100000),
          e(cdn, apigw, "HTTP", true, 100, 10, 50000),
          e(apigw, auth, "HTTP", true, 30, 5, 8000),
          e(apigw, rec, "HTTP", true, 70, 5, 6000),
          e(auth, pg, "TCP", true, 100, 2, 3000),
          e(rec, mongo, "TCP", true, 100, 3, 8000),
          e(rec, kafka, "AMQP", false, 100, 5, 6000),
          e(kafka, workers, "AMQP", false, 100, 10, 2000),
        ],
      };
    },
  },
  {
    id: "uber-dispatch", label: "Uber Real-time Dispatch", icon: Car,
    desc: "Mobile → LB → WebSocket → Dispatch Engine → Redis Geospatial + PostgreSQL",
    industry: "RideShare", scale: "200K RPS", tags: ["RideShare", "Real-time", "Mobility"],
    totalInstances: 36, peakRPS: 200000,
    nodePreview: [
      { label: "Rider App", type: "MobileClient" },
      { label: "Global LB", type: "LoadBalancer" },
      { label: "WebSocket Servers", type: "AppServer" },
      { label: "Dispatch Engine", type: "Microservice" },
      { label: "Redis Geospatial", type: "Redis" },
      { label: "Trip History DB", type: "PostgreSQLDB" },
    ],
    edgePreview: [
      { from: "Rider App", to: "Global LB", protocol: "WebSocket" },
      { from: "Global LB", to: "WebSocket Servers", protocol: "WebSocket" },
      { from: "WebSocket Servers", to: "Dispatch Engine", protocol: "gRPC" },
      { from: "Dispatch Engine", to: "Redis Geospatial", protocol: "TCP" },
      { from: "Dispatch Engine", to: "Trip History DB", protocol: "HTTP" },
    ],
    build: (ox, oy) => {
      const [mobile, lb, ws, dispatch, redis, pg] = [
        n("MobileClient","Rider App",0,80,{instances:0,maxRPS:50000,latencyMs:20,region:"us-east-1",security:{isPublicFacing:true,requiresTLS:true,allowedInbound:["0.0.0.0/0"],vpcId:""}},ox,oy),
        n("LoadBalancer","Global LB",280,80,{instances:2,maxRPS:200000,latencyMs:3,region:"us-east-1"},ox,oy),
        n("AppServer","WebSocket Servers",560,80,{instances:10,maxRPS:100000,latencyMs:15,region:"us-east-1",autoScaling:{enabled:true,minInstances:5,maxInstances:30,targetCPUPercent:60,targetMemPercent:70,cooldownTicks:2,scaleUpFactor:2,scaleDownFactor:0.5}},ox,oy),
        n("Microservice","Dispatch Engine",840,80,{instances:15,maxRPS:15000,latencyMs:8,region:"us-east-1",autoScaling:{enabled:true,minInstances:8,maxInstances:40,targetCPUPercent:75,targetMemPercent:80,cooldownTicks:3,scaleUpFactor:1.5,scaleDownFactor:0.5}},ox,oy),
        n("Redis","Redis Geospatial",1120,-60,{instances:6,maxRPS:50000,latencyMs:2,region:"us-east-1",isPrimaryDB:true,replicationRole:"primary"},ox,oy),
        n("PostgreSQLDB","Trip History DB",1120,220,{instances:3,maxRPS:5000,latencyMs:30,region:"us-east-1",isPrimaryDB:false,replicationRole:"async_replica",replicationLagMs:100},ox,oy),
      ];
      return {
        nodes: [mobile, lb, ws, dispatch, redis, pg],
        edges: [
          e(mobile, lb, "WebSocket", true, 100, 5, 50000),
          e(lb, ws, "WebSocket", true, 100, 3, 50000),
          e(ws, dispatch, "gRPC", true, 100, 2, 15000),
          e(dispatch, redis, "TCP", true, 100, 1, 15000),
          e(dispatch, pg, "HTTP", false, 30, 5, 1500),
        ],
      };
    },
  },
  {
    id: "ecommerce-bf", label: "E-Commerce Black Friday", icon: ShoppingCart,
    desc: "Shoppers → CDN → ALB → Cart + Queue → Primary DB + 2 Read Replicas",
    industry: "E-Commerce", scale: "100K RPS", tags: ["E-Commerce", "Retail", "Black Friday"],
    totalInstances: 79, peakRPS: 100000,
    nodePreview: [
      { label: "Shoppers", type: "WebBrowser" },
      { label: "CDN Assets", type: "CDN" },
      { label: "ALB", type: "LoadBalancer" },
      { label: "Cart Service", type: "Microservice" },
      { label: "Payment Gateway", type: "ThirdPartyAPI" },
      { label: "Order Queue", type: "MessageQueue" },
      { label: "Orders Primary", type: "PostgreSQLDB" },
      { label: "Read Replica 1", type: "PostgreSQLDB" },
      { label: "Read Replica 2", type: "PostgreSQLDB" },
    ],
    edgePreview: [
      { from: "Shoppers", to: "CDN Assets", protocol: "HTTP" },
      { from: "CDN Assets", to: "ALB", protocol: "HTTP" },
      { from: "ALB", to: "Cart Service", protocol: "HTTP" },
      { from: "ALB", to: "Order Queue", protocol: "HTTP" },
      { from: "Cart Service", to: "Payment Gateway", protocol: "HTTP" },
      { from: "Cart Service", to: "Order Queue", protocol: "AMQP" },
      { from: "Order Queue", to: "Orders Primary", protocol: "TCP" },
      { from: "Orders Primary", to: "Read Replica 1", protocol: "Replication" },
      { from: "Orders Primary", to: "Read Replica 2", protocol: "Replication" },
    ],
    build: (ox, oy) => {
      const [shoppers, cdn, alb, cart, payment, queue, primary, replica1, replica2] = [
        n("WebBrowser","Shoppers",0,60,{instances:0,maxRPS:100000,latencyMs:20,region:"us-east-1"},ox,oy),
        n("CDN","CDN Assets",280,60,{instances:50,maxRPS:100000,latencyMs:3,cacheHitRatio:0.95,region:"us-east-1"},ox,oy),
        n("LoadBalancer","ALB",560,60,{instances:5,maxRPS:50000,latencyMs:5,region:"us-east-1"},ox,oy),
        n("Microservice","Cart Service",840,-80,{instances:10,maxRPS:8000,latencyMs:20,region:"us-east-1",autoScaling:{enabled:true,minInstances:5,maxInstances:30,targetCPUPercent:70,targetMemPercent:80,cooldownTicks:3,scaleUpFactor:2,scaleDownFactor:0.5},deployment:{strategy:"blue_green",canaryPercent:0,canaryVersion:"",isCanaryActive:false,blueGreenGroup:"blue",activeGroup:"blue"}},ox,oy),
        n("ThirdPartyAPI","Payment Gateway",1120,-80,{instances:0,maxRPS:2000,latencyMs:150,region:"us-east-1",errorRate:0.02},ox,oy),
        n("MessageQueue","Order Queue",840,200,{instances:6,maxRPS:15000,latencyMs:5,region:"us-east-1"},ox,oy),
        n("PostgreSQLDB","Orders Primary",1120,200,{instances:2,maxRPS:5000,latencyMs:15,region:"us-east-1",isPrimaryDB:true,replicationRole:"primary"},ox,oy),
        n("PostgreSQLDB","Read Replica 1",1400,-80,{instances:2,maxRPS:2000,latencyMs:30,region:"us-east-1",isPrimaryDB:false,replicationRole:"read_replica",replicationLagMs:50},ox,oy),
        n("PostgreSQLDB","Read Replica 2",1400,480,{instances:2,maxRPS:2000,latencyMs:30,region:"us-east-1",isPrimaryDB:false,replicationRole:"read_replica",replicationLagMs:50},ox,oy),
      ];
      return {
        nodes: [shoppers, cdn, alb, cart, payment, queue, primary, replica1, replica2],
        edges: [
          e(shoppers, cdn, "HTTP", true, 100, 5, 100000),
          e(cdn, alb, "HTTP", true, 100, 10, 50000),
          e(alb, cart, "HTTP", true, 70, 3, 8000),
          e(alb, queue, "HTTP", true, 30, 3, 3000),
          e(cart, payment, "HTTP", true, 100, 10, 2000),
          e(cart, queue, "AMQP", false, 80, 2, 8000),
          e(queue, primary, "TCP", true, 100, 3, 5000),
          e(primary, replica1, "Replication", false, 50, 2, 2500),
          e(primary, replica2, "Replication", false, 50, 2, 2500),
        ],
      };
    },
  },
  {
    id: "hft-pipeline", label: "High-Frequency Trading Pipeline", icon: Zap,
    desc: "MarketFeed → Kafka → StreamProcessor → MatchingEngine → OrderGateway (sub-5ms hot path)",
    industry: "Finance", scale: "100K RPS", tags: ["Finance", "Trading", "Low-Latency"],
    totalInstances: 27, peakRPS: 100000,
    nodePreview: [
      { label: "Market Data Feed", type: "ExternalClient" },
      { label: "Kafka Ingest", type: "EventBus" },
      { label: "Stream Processor", type: "ContainerCluster" },
      { label: "Matching Engine", type: "Microservice" },
      { label: "Order Gateway", type: "APIGateway" },
    ],
    edgePreview: [
      { from: "Market Data Feed", to: "Kafka Ingest", protocol: "TCP" },
      { from: "Kafka Ingest", to: "Stream Processor", protocol: "TCP" },
      { from: "Stream Processor", to: "Matching Engine", protocol: "gRPC" },
      { from: "Matching Engine", to: "Order Gateway", protocol: "HTTP" },
    ],
    build: (ox, oy) => {
      const [feed, kafka, stream, match, gateway] = [
        n("ExternalClient","Market Data Feed",0,60,{instances:0,maxRPS:50000,latencyMs:5,region:"us-east-1"},ox,oy),
        n("EventBus","Kafka Ingest",280,60,{instances:5,maxRPS:100000,latencyMs:2,region:"us-east-1"},ox,oy),
        n("ContainerCluster","Stream Processor",560,60,{instances:10,maxRPS:20000,latencyMs:3,region:"us-east-1",computeTier:"reserved"},ox,oy),
        n("Microservice","Matching Engine",840,60,{instances:8,maxRPS:50000,latencyMs:1,region:"us-east-1",computeTier:"reserved",deployment:{strategy:"blue_green",canaryPercent:0,canaryVersion:"",isCanaryActive:false,blueGreenGroup:"blue",activeGroup:"blue"}},ox,oy),
        n("APIGateway","Order Gateway",1120,60,{instances:4,maxRPS:50000,latencyMs:2,region:"us-east-1",security:{isPublicFacing:true,requiresTLS:true,allowedInbound:["0.0.0.0/0"],vpcId:"vpc-hft"}},ox,oy),
      ];
      return {
        nodes: [feed, kafka, stream, match, gateway],
        edges: [
          e(feed, kafka, "TCP", false, 100, 1, 50000),
          e(kafka, stream, "TCP", false, 100, 2, 50000),
          e(stream, match, "gRPC", true, 100, 1, 20000),
          e(match, gateway, "HTTP", true, 100, 1, 20000),
        ],
      };
    },
  },
  {
    id: "rag-chatbot", label: "RAG Chatbot", icon: MessageSquareText,
    desc: "Gateway → Cache → LLM → VectorDB → LLM → Stream — multi-hop RAG with context injection",
    industry: "AI/ML", scale: "10K RPS", tags: ["AI", "RAG", "Chatbot", "LLM"],
    totalInstances: 8, peakRPS: 10000,
    nodePreview: [
      { label: "API Gateway", type: "APIGateway" },
      { label: "Cache", type: "Redis" },
      { label: "LLM (Embed)", type: "LLMNode" },
      { label: "VectorDB", type: "VectorDB" },
      { label: "LLM (Generate)", type: "LLMNode" },
      { label: "Stream Out", type: "ServerlessV2" },
    ],
    edgePreview: [
      { from: "API Gateway", to: "Cache", protocol: "HTTP" },
      { from: "Cache", to: "LLM (Embed)", protocol: "HTTP" },
      { from: "LLM (Embed)", to: "VectorDB", protocol: "gRPC" },
      { from: "VectorDB", to: "LLM (Generate)", protocol: "gRPC" },
      { from: "LLM (Generate)", to: "Stream Out", protocol: "WebSocket" },
    ],
    build: (ox, oy) => {
      const [gw, cache, llm1, vdb, llm2, stream] = [
        n("APIGateway","API Gateway",0,80,{instances:2,maxRPS:10000,latencyMs:5,region:"us-east-1",security:{isPublicFacing:true,requiresTLS:true,allowedInbound:["0.0.0.0/0"],vpcId:"vpc-rag"}},ox,oy),
        n("Redis","Cache",280,80,{instances:2,maxRPS:20000,latencyMs:2,region:"us-east-1",cacheHitRatio:0.8},ox,oy),
        n("LLMNode","LLM (Embed)",560,80,{instances:2,maxRPS:500,latencyMs:30,region:"us-east-1",tokensPerSecond:1000,promptTokenCount:512,completionTokenCount:128,ragQueryTokens:300},ox,oy),
        n("VectorDB","VectorDB",840,80,{instances:2,maxRPS:2000,latencyMs:10,region:"us-east-1",dimensions:1536,indexType:"hnsw",topK:10},ox,oy),
        n("LLMNode","LLM (Generate)",1120,80,{instances:2,maxRPS:500,latencyMs:50,region:"us-east-1",tokensPerSecond:1000,promptTokenCount:512,completionTokenCount:256,ragContextTokens:500},ox,oy),
        n("ServerlessV2","Stream Out",1400,80,{instances:2,maxRPS:2000,latencyMs:10,region:"us-east-1",snapStartEnabled:true},ox,oy),
      ];
      return {
        nodes: [gw, cache, llm1, vdb, llm2, stream],
        edges: [
          e(gw, cache, "HTTP", true, 100, 3, 10000),
          e(cache, llm1, "HTTP", true, 100, 5, 5000),
          e(llm1, vdb, "gRPC", true, 100, 10, 500),
          e(vdb, llm2, "gRPC", true, 100, 15, 500),
          e(llm2, stream, "WebSocket", false, 100, 20, 500),
        ],
      };
    },
  },
  {
    id: "ecommerce-saga", label: "E-Commerce Saga", icon: GitBranch,
    desc: "Order API → Orchestrator → [Payment, Inventory, Shipping] with compensation rollback",
    industry: "E-Commerce", scale: "5K RPS", tags: ["E-Commerce", "Saga", "Orchestrator", "Workflow"],
    totalInstances: 14, peakRPS: 5000,
    nodePreview: [
      { label: "Order API", type: "APIGateway" },
      { label: "Orchestrator", type: "Orchestrator" },
      { label: "Payment Worker", type: "WorkerService" },
      { label: "Inventory Worker", type: "WorkerService" },
      { label: "Shipping Worker", type: "WorkerService" },
      { label: "Orders DB", type: "PostgreSQLDB" },
    ],
    edgePreview: [
      { from: "Order API", to: "Orchestrator", protocol: "HTTP" },
      { from: "Orchestrator", to: "Payment Worker", protocol: "HTTP" },
      { from: "Orchestrator", to: "Inventory Worker", protocol: "HTTP" },
      { from: "Orchestrator", to: "Shipping Worker", protocol: "HTTP" },
      { from: "Payment Worker", to: "Orders DB", protocol: "TCP" },
      { from: "Inventory Worker", to: "Orders DB", protocol: "TCP" },
      { from: "Shipping Worker", to: "Orders DB", protocol: "TCP" },
    ],
    build: (ox, oy) => {
      const [api, orch, pay, inv, ship, db] = [
        n("APIGateway","Order API",0,60,{instances:2,maxRPS:5000,latencyMs:5,region:"us-east-1",security:{isPublicFacing:true,requiresTLS:true,allowedInbound:["0.0.0.0/0"],vpcId:"vpc-saga"}},ox,oy),
        n("Orchestrator","Saga Orchestrator",280,60,{instances:2,maxRPS:1000,latencyMs:10,region:"us-east-1",failureMode:"compensate"},ox,oy),
        n("WorkerService","Payment Worker",560,-80,{instances:2,maxRPS:500,latencyMs:80,region:"us-east-1",errorRate:0.01},ox,oy),
        n("WorkerService","Inventory Worker",560,60,{instances:2,maxRPS:500,latencyMs:40,region:"us-east-1",errorRate:0.005},ox,oy),
        n("WorkerService","Shipping Worker",560,200,{instances:2,maxRPS:300,latencyMs:100,region:"us-east-1",errorRate:0.02},ox,oy),
        n("PostgreSQLDB","Orders DB",840,60,{instances:2,maxRPS:2000,latencyMs:15,region:"us-east-1",isPrimaryDB:true,replicationRole:"primary"},ox,oy),
      ];
      return {
        nodes: [api, orch, pay, inv, ship, db],
        edges: [
          e(api, orch, "HTTP", true, 100, 5, 5000),
          e(orch, pay, "HTTP", true, 33, 2, 500),
          e(orch, inv, "HTTP", true, 33, 2, 500),
          e(orch, ship, "HTTP", true, 34, 2, 300),
          e(pay, db, "TCP", true, 100, 3, 500),
          e(inv, db, "TCP", true, 100, 3, 500),
          e(ship, db, "TCP", true, 100, 3, 300),
        ],
      };
    },
  },
];
