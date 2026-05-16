import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore } from "../store/projectStore";
import { nodeTypes, edgeTypes, getReactFlowType } from "../components/canvas/nodeTypes";
import { NODE_REGISTRY } from "../utils/nodeRegistry";
import type { NodeType } from "../types/canvas";

function enrichNode(node: Node): Node {
  const nt = (node as any).data?.nodeType as NodeType | undefined;
  if (nt && NODE_REGISTRY[nt]) {
    return { ...node, type: getReactFlowType(nt) };
  }
  return node;
}

const defaultNodes: Node[] = [
  {
    id: "web-browser",
    type: "default",
    position: { x: 250, y: 0 },
    data: {
      nodeType: "WebBrowser",
      label: "Web Browser",
      config: { instances: 0, region: "us-east-1", maxRPS: 3000, latencyMs: 100, errorRate: 0.001, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 0, canaryVersion: "", isCanaryActive: false }, security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
  {
    id: "lb",
    type: "loadBalancer",
    position: { x: 250, y: 120 },
    data: {
      nodeType: "LoadBalancer",
      label: "Load Balancer",
      config: { instances: 2, region: "us-east-1", maxRPS: 10000, latencyMs: 5, errorRate: 0.01, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 20, canaryVersion: "v2", isCanaryActive: true }, security: { isPublicFacing: true, requiresTLS: true, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
  {
    id: "app",
    type: "default",
    position: { x: 250, y: 260 },
    data: {
      nodeType: "AppServer",
      label: "App Server",
      config: { instances: 3, region: "us-east-1", maxRPS: 2000, latencyMs: 30, errorRate: 0.01, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 0, canaryVersion: "", isCanaryActive: false }, security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
  {
    id: "db",
    type: "database",
    position: { x: 250, y: 400 },
    data: {
      nodeType: "PostgreSQLDB",
      label: "PostgreSQL",
      config: { instances: 1, region: "us-east-1", maxRPS: 1000, latencyMs: 50, errorRate: 0.001, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 0, canaryVersion: "", isCanaryActive: false }, security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
  {
    id: "queue",
    type: "messageQueue",
    position: { x: 450, y: 260 },
    data: {
      nodeType: "MessageQueue",
      label: "Message Queue",
      config: { instances: 3, region: "us-east-1", maxRPS: 10000, latencyMs: 15, errorRate: 0.005, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 0, canaryVersion: "", isCanaryActive: false }, security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 4500, cpuPercent: 0, memoryPercent: 0, queueDepth: 340, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
  {
    id: "cluster",
    type: "containerCluster",
    position: { x: 450, y: 400 },
    data: {
      nodeType: "ContainerCluster",
      label: "K8s Cluster",
      config: { instances: 5, region: "us-east-1", maxRPS: 5000, latencyMs: 15, errorRate: 0.01, isFailed: false, isBottleneck: false, deployment: { strategy: "rolling", canaryPercent: 0, canaryVersion: "", isCanaryActive: false }, security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" } },
      simulationState: { status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0, errorCount: 0, p99LatencyMs: 0, canaryRPS: 0 },
    },
  },
];

const defaultEdges: Edge[] = [
  { id: "e-browser-lb", source: "web-browser", target: "lb", type: "default", data: { routing: { protocol: "HTTP", isSync: true, trafficPercent: 100, requiresTLS: true }, throughputRPS: 0, latencyMs: 0, isAnimated: true, isSaturated: false, isSecure: true } },
  { id: "e-lb-app", source: "lb", target: "app", type: "default", data: { routing: { protocol: "HTTP", isSync: true, trafficPercent: 80, requiresTLS: false }, throughputRPS: 0, latencyMs: 0, isAnimated: true, isSaturated: false, isSecure: true } },
  { id: "e-lb-queue", source: "lb", target: "queue", type: "default", data: { routing: { protocol: "HTTP", isSync: true, trafficPercent: 20, requiresTLS: false }, throughputRPS: 0, latencyMs: 0, isAnimated: true, isSaturated: false, isSecure: true } },
  { id: "e-app-db", source: "app", target: "db", type: "default", data: { routing: { protocol: "TCP", isSync: true, trafficPercent: 100, requiresTLS: false }, throughputRPS: 0, latencyMs: 0, isAnimated: false, isSaturated: true, isSecure: false } },
  { id: "e-queue-cluster", source: "queue", target: "cluster", type: "default", data: { routing: { protocol: "AMQP", isSync: false, trafficPercent: 100, requiresTLS: false }, throughputRPS: 0, latencyMs: 0, isAnimated: false, isSaturated: false, isSecure: true } },
];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, isLoading, error, getProject, saveCanvas } = useProjectStore();
  const [nodes, setNodes] = useState<Node[]>(defaultNodes.map(enrichNode));
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  useEffect(() => {
    if (id) getProject(id);
  }, [id, getProject]);

  useEffect(() => {
    if (currentProject?.canvas_data?.nodes || currentProject?.canvas_data?.edges) {
      const cd = currentProject.canvas_data;
      if (cd.nodes?.length) setNodes(cd.nodes.map(enrichNode));
      if (cd.edges?.length) setEdges(cd.edges);
    }
    }, [currentProject]);

  const autoSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const canvasData = { nodes: nodesRef.current, edges: edgesRef.current };
      const updatedAt = await saveCanvas(id, canvasData);
      setLastSaved(updatedAt);
    } catch {}
    setSaving(false);
  }, [id, saveCanvas]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 2000);
  }, [autoSave]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      scheduleSave();
    },
    [scheduleSave],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      scheduleSave();
    },
    [scheduleSave],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      setEdges((eds) => addEdge({
        ...params,
        type: "default",
        data: {
          routing: { protocol: "HTTP", isSync: true, trafficPercent: 100, requiresTLS: false },
          throughputRPS: 0,
          latencyMs: 0,
          isAnimated: false,
          isSaturated: false,
          isSecure: true,
        },
      } as Edge, eds));
      scheduleSave();
    },
    [scheduleSave],
  );

  if (isLoading && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-surface-400 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-950 text-surface-100 flex flex-col">
      <header className="border-b border-surface-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            &larr; Dashboard
          </button>
          <h1 className="text-sm font-medium">{currentProject?.name || "Project"}</h1>
          {currentProject?.role && (
            <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded">
              {currentProject.role}
            </span>
          )}
          <span className="text-[10px] text-surface-500">
            {saving ? "saving..." : lastSaved ? "saved" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/project/${id}/observe`)}
            className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            Observability
          </button>
        </div>
      </header>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background color="#27272a" gap={20} />
          <Controls className="bg-surface-900 border-surface-700 [&>button]:border-surface-700 [&>button]:bg-surface-800 [&>button]:hover:bg-surface-700" />
          <MiniMap
            className="border border-surface-700 rounded-lg"
            style={{ background: "#09090b" }}
            nodeColor="#27272a"
            maskColor="rgba(9,9,11,0.7)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
