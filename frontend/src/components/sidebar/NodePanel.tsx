import { useCallback, useState, type DragEvent } from "react";
import type { Node, Edge } from "reactflow";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { NodeCategory, type NodeType } from "../../types/canvas";
import type { NodeConfig, EdgeRoutingConfig } from "../../types/canvas";
import { getReactFlowType } from "../canvas/nodeTypes";

const categories = [
  { key: NodeCategory.Infrastructure, label: "Infrastructure" },
  { key: NodeCategory.Data, label: "Data" },
  { key: NodeCategory.Network, label: "Network" },
  { key: NodeCategory.Messaging, label: "Messaging" },
  { key: NodeCategory.Compute, label: "Compute" },
  { key: NodeCategory.External, label: "External" },
];

function onDragStart(event: DragEvent, nodeType: NodeType) {
  event.dataTransfer.setData("application/node-type", nodeType);
  event.dataTransfer.effectAllowed = "move";
}

function makeNode(
  id: string,
  nodeType: NodeType,
  label: string,
  position: { x: number; y: number },
  configOverride?: Partial<NodeConfig>,
): Node {
  const meta = NODE_REGISTRY[nodeType];
  const config = configOverride ? { ...meta.defaultConfig, ...configOverride } : meta.defaultConfig;
  return {
    id,
    type: getReactFlowType(nodeType),
    position,
    data: {
      nodeType,
      label,
      config,
      simulationState: { status: "healthy" as const, uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  data?: Partial<{ routing: Partial<EdgeRoutingConfig>; throughputRPS: number; latencyMs: number; isAnimated: boolean; isSaturated: boolean; isSecure: boolean }>,
): Edge {
  return {
    id,
    source,
    target,
    type: "default",
    data: {
      routing: { protocol: "HTTP", isSync: true, trafficPercent: 100, requiresTLS: false, ...data?.routing },
      throughputRPS: data?.throughputRPS ?? 0,
      latencyMs: data?.latencyMs ?? 0,
      isAnimated: data?.isAnimated ?? false,
      isSaturated: data?.isSaturated ?? false,
      isSecure: data?.isSecure ?? true,
    },
  };
}

interface TemplateDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodeCount: number;
  edgeCount: number;
  build: (origin: { x: number; y: number }) => { nodes: Node[]; edges: Edge[] };
}

const templates: TemplateDef[] = [
  {
    id: "simple-web-app",
    name: "Simple Web App",
    description: "Client → LB → AppServer → PostgreSQL",
    icon: "🌐",
    nodeCount: 4,
    edgeCount: 3,
    build: (o) => ({
      nodes: [
        makeNode("t-sw-wb", "WebBrowser", "Web Browser", { x: o.x, y: o.y }),
        makeNode("t-sw-lb", "LoadBalancer", "Load Balancer", { x: o.x + 280, y: o.y }),
        makeNode("t-sw-as", "AppServer", "App Server", { x: o.x + 560, y: o.y }),
        makeNode("t-sw-db", "PostgreSQLDB", "Database", { x: o.x + 840, y: o.y }),
      ],
      edges: [
        makeEdge("t-sw-e1", "t-sw-wb", "t-sw-lb"),
        makeEdge("t-sw-e2", "t-sw-lb", "t-sw-as"),
        makeEdge("t-sw-e3", "t-sw-as", "t-sw-db"),
      ],
    }),
  },
  {
    id: "microservices",
    name: "Microservices",
    description: "APIGateway → 3 Microservices → Redis + PostgreSQL",
    icon: "🧩",
    nodeCount: 6,
    edgeCount: 6,
    build: (o) => ({
      nodes: [
        makeNode("t-ms-gw", "APIGateway", "API Gateway", { x: o.x, y: o.y }),
        makeNode("t-ms-m1", "Microservice", "Users Service", { x: o.x + 320, y: o.y - 140 }),
        makeNode("t-ms-m2", "Microservice", "Orders Service", { x: o.x + 320, y: o.y }),
        makeNode("t-ms-m3", "Microservice", "Payments Service", { x: o.x + 320, y: o.y + 140 }),
        makeNode("t-ms-rd", "Redis", "Cache", { x: o.x + 640, y: o.y - 80 }),
        makeNode("t-ms-db", "PostgreSQLDB", "Database", { x: o.x + 640, y: o.y + 80 }),
      ],
      edges: [
        makeEdge("t-ms-e1", "t-ms-gw", "t-ms-m1"),
        makeEdge("t-ms-e2", "t-ms-gw", "t-ms-m2"),
        makeEdge("t-ms-e3", "t-ms-gw", "t-ms-m3"),
        makeEdge("t-ms-e4", "t-ms-m1", "t-ms-rd"),
        makeEdge("t-ms-e5", "t-ms-m2", "t-ms-db"),
        makeEdge("t-ms-e6", "t-ms-m3", "t-ms-db"),
      ],
    }),
  },
  {
    id: "event-driven",
    name: "Event-Driven",
    description: "Producer → MessageQueue → Worker → Database",
    icon: "📨",
    nodeCount: 4,
    edgeCount: 3,
    build: (o) => ({
      nodes: [
        makeNode("t-ed-pr", "WebServer", "Event Producer", { x: o.x, y: o.y }),
        makeNode("t-ed-mq", "MessageQueue", "Message Queue", { x: o.x + 280, y: o.y }),
        makeNode("t-ed-wk", "WorkerService", "Worker", { x: o.x + 560, y: o.y }),
        makeNode("t-ed-db", "MongoDB", "Database", { x: o.x + 840, y: o.y }),
      ],
      edges: [
        makeEdge("t-ed-e1", "t-ed-pr", "t-ed-mq", { routing: { isSync: false } }),
        makeEdge("t-ed-e2", "t-ed-mq", "t-ed-wk", { routing: { isSync: false } }),
        makeEdge("t-ed-e3", "t-ed-wk", "t-ed-db"),
      ],
    }),
  },
  {
    id: "blue-green",
    name: "Blue/Green Deployment",
    description: "LB → [AppServer-v1, AppServer-v2] → DB with 80/20 routing",
    icon: "🔄",
    nodeCount: 4,
    edgeCount: 3,
    build: (o) => ({
      nodes: [
        makeNode("t-bg-lb", "LoadBalancer", "Load Balancer", { x: o.x, y: o.y }),
        makeNode("t-bg-v1", "WebServer", "App Server v1 (Blue)", { x: o.x + 320, y: o.y - 120 }, { deployment: { strategy: "blue_green", canaryPercent: 80, canaryVersion: "v1", isCanaryActive: false } }),
        makeNode("t-bg-v2", "WebServer", "App Server v2 (Green)", { x: o.x + 320, y: o.y + 120 }, { deployment: { strategy: "blue_green", canaryPercent: 20, canaryVersion: "v2", isCanaryActive: true } }),
        makeNode("t-bg-db", "PostgreSQLDB", "Database", { x: o.x + 640, y: o.y }),
      ],
      edges: [
        makeEdge("t-bg-e1", "t-bg-lb", "t-bg-v1", { routing: { trafficPercent: 80 } }),
        makeEdge("t-bg-e2", "t-bg-lb", "t-bg-v2", { routing: { trafficPercent: 20 } }),
        makeEdge("t-bg-e3", "t-bg-v1", "t-bg-db"),
        makeEdge("t-bg-e4", "t-bg-v2", "t-bg-db"),
      ],
    }),
  },
];

export { templates };
export type { TemplateDef };

export default function NodePanel({ onApplyTemplate }: { onApplyTemplate: (nodes: Node[], edges: Edge[]) => void }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"nodes" | "templates">("nodes");

  const renderCategory = useCallback(({ key, label }: { key: string; label: string }) => {
    const entries = Object.entries(NODE_REGISTRY).filter(
      ([, meta]) => meta.category === key,
    );
    if (entries.length === 0) return null;

    const filtered = search
      ? entries.filter(([, meta]) =>
          meta.label.toLowerCase().includes(search.toLowerCase()),
        )
      : entries;

    if (filtered.length === 0) return null;

    return (
      <div key={key}>
        <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5 px-3">
          {label}
        </h3>
        <div className="space-y-0.5 px-2">
          {filtered.map(([type, meta]) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type as NodeType)}
              className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-surface-800 transition-colors text-surface-300 hover:text-surface-100 group"
            >
              <div className="w-0.5 h-5 rounded-r-full shrink-0" style={{ backgroundColor: meta.color }} />
              <span className="text-base w-5 text-center shrink-0">{meta.icon}</span>
              <span className="text-xs truncate flex-1">{meta.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [search]);

  return (
    <aside className="w-60 shrink-0 bg-surface-950 border-r border-surface-800 overflow-y-auto select-none flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-surface-800 shrink-0">
        <button
          onClick={() => setActiveTab("nodes")}
          className={`flex-1 text-[11px] font-medium py-2.5 transition-colors ${activeTab === "nodes" ? "text-surface-100 border-b-2 border-green-500" : "text-surface-500 hover:text-surface-300"}`}
        >
          Nodes
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex-1 text-[11px] font-medium py-2.5 transition-colors ${activeTab === "templates" ? "text-surface-100 border-b-2 border-green-500" : "text-surface-500 hover:text-surface-300"}`}
        >
          Templates
        </button>
      </div>

      {activeTab === "nodes" && (
        <>
          {/* Search */}
          <div className="p-2 border-b border-surface-800 shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes..."
              className="w-full bg-surface-800 text-surface-200 text-[11px] px-2.5 py-1.5 rounded border border-surface-700 placeholder-surface-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Node list */}
          <div className="py-3 space-y-4 flex-1 overflow-y-auto">
            {search && Object.keys(NODE_REGISTRY).filter((t) =>
              NODE_REGISTRY[t as NodeType].label.toLowerCase().includes(search.toLowerCase()),
            ).length === 0 ? (
              <div className="text-[11px] text-surface-500 text-center py-8">No nodes match your search</div>
            ) : (
              categories.map(renderCategory)
            )}
          </div>
        </>
      )}

      {activeTab === "templates" && (
        <div className="py-3 space-y-2 px-2 flex-1 overflow-y-auto">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-surface-900 border border-surface-800 rounded-lg p-3 hover:border-surface-700 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-lg shrink-0 mt-0.5">{tpl.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-surface-200">{tpl.name}</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">{tpl.description}</div>
                  <div className="text-[9px] text-surface-600 mt-1">
                    {tpl.nodeCount} nodes · {tpl.edgeCount} edges
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const { nodes: tn, edges: te } = tpl.build({ x: 0, y: 0 });
                  onApplyTemplate(tn, te);
                }}
                className="mt-2.5 w-full text-[10px] font-medium py-1.5 rounded bg-surface-800 hover:bg-green-600 hover:text-white text-surface-300 transition-colors"
              >
                Apply Template
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
