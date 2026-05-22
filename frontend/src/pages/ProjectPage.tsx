import { useEffect, useCallback, useRef, useState, useMemo, type DragEvent } from "react";
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
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore } from "../store/projectStore";
import { useCanvasStore } from "../store/canvasStore";
import { nodeTypes, edgeTypes, getReactFlowType } from "../components/canvas/nodeTypes";
import { NODE_REGISTRY } from "../utils/nodeRegistry";
import NodePanel from "../components/sidebar/NodePanel";
import NodeConfigPanel from "../components/panels/NodeConfigPanel";
import SimulationPanel from "../components/panels/SimulationPanel";
import ChaosPanel from "../components/panels/ChaosPanel";
import DeploymentPanel from "../components/panels/DeploymentPanel";
import SecurityPanel from "../components/panels/SecurityPanel";
import FinOpsPanel from "../components/panels/FinOpsPanel";
import TopToolbar from "../components/toolbar/TopToolbar";
import ToastContainer from "../components/ui/Toast";
import { useSimulation } from "../hooks/useSimulation";
import { useCollaboration, CURSOR_COLORS } from "../hooks/useCollaboration";
import { useChaosStore } from "../store/chaosStore";
import { useDeployStore } from "../store/deploymentStore";
import { useSecurityStore } from "../store/securityStore";
import { useFinOpsStore } from "../store/finopsStore";
import { useAuthStore } from "../store/authStore";
import { useExportStore } from "../store/exportStore";
import ExportModal from "../components/panels/ExportModal";
import type { NodeType, NodeMetrics, SimulationNodeState } from "../types/canvas";

const VPC_COLORS = [
  "rgba(59,130,246,0.08)", "rgba(16,185,129,0.08)", "rgba(245,158,11,0.08)",
  "rgba(139,92,246,0.08)", "rgba(239,68,68,0.08)", "rgba(236,72,153,0.08)",
  "rgba(14,165,233,0.08)", "rgba(168,85,247,0.08)",
];

function VpcBoundaries({ nodes }: { nodes: Node[] }) {
  const groups = new Map<string, { x: number[]; y: number[] }>();
  nodes.forEach((n) => {
    const vpcId = (n.data as any)?.config?.security?.vpcId;
    if (!vpcId) return;
    if (!groups.has(vpcId)) groups.set(vpcId, { x: [], y: [] });
    const g = groups.get(vpcId)!;
    g.x.push(n.position.x);
    g.y.push(n.position.y);
  });
  const colorIndex = useRef(0);
  const colorMap = useRef<Map<string, string>>(new Map());
  const rects = useMemo(() => {
    colorIndex.current = 0;
    return Array.from(groups.entries()).map(([vpcId, coords]) => {
      if (!colorMap.current.has(vpcId)) {
        colorMap.current.set(vpcId, VPC_COLORS[colorIndex.current % VPC_COLORS.length]);
        colorIndex.current++;
      }
      const minX = Math.min(...coords.x) - 40;
      const minY = Math.min(...coords.y) - 40;
      const maxX = Math.max(...coords.x) + 220;
      const maxY = Math.max(...coords.y) + 120;
      return { vpcId, x: minX, y: minY, width: maxX - minX, height: maxY - minY, color: colorMap.current.get(vpcId)! };
    });
  }, [nodes]);
  return (
    <>
      {rects.map((r) => (
        <rect
          key={r.vpcId}
          x={r.x} y={r.y} width={r.width} height={r.height}
          fill={r.color}
          stroke={r.color.replace("0.08", "0.25")}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          rx={12}
          ry={12}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

const DEFAULT_SIM: SimulationNodeState = {
  status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0,
};

const DEFAULT_METRICS: NodeMetrics = {
  currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0,
  errorCount: 0, p99LatencyMs: 0, canaryRPS: 0, errorRate: 0,
};

function enrichNode(node: Node): Node {
  const nt = (node as any).data?.nodeType as NodeType | undefined;
  if (nt && NODE_REGISTRY[nt]) {
    return { ...node, type: getReactFlowType(nt) };
  }
  return node;
}

function ProjectCanvas({ id: projectId }: { id: string }) {
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const { currentProject, isLoading, error, getProject, saveCanvas } = useProjectStore();

  const store = useCanvasStore();
  const {
    nodes, edges,
    setNodes, setEdges, addNode, removeNode, removeEdge,
    selectNode, selectEdge, markDirty, markSaved,
    pushUndoState, undo, redo, addEdge, loadTemplate,
  } = store;

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [saving, setSaving] = useState(false);
  const showExportModal = useExportStore((s) => s.showModal);
  const setExportMode = useCanvasStore((s) => s.setExportMode);

  useEffect(() => {
    setExportMode(showExportModal);
  }, [showExportModal, setExportMode]);

  const [showSimPanel, setShowSimPanel] = useState(false);
  const showChaosPanel = useChaosStore((s) => s.showChaosPanel);
  const setShowChaosPanel = useChaosStore((s) => s.setShowChaosPanel);
  const showDeployPanel = useDeployStore((s) => s.showDeployPanel);
  const setShowDeployPanel = useDeployStore((s) => s.setShowDeployPanel);
  const showSecurityPanel = useSecurityStore((s) => s.showSecurityPanel);
  const setShowSecurityPanel = useSecurityStore((s) => s.setShowSecurityPanel);
  const showFinOpsPanel = useFinOpsStore((s) => s.showPanel);
  const setShowFinOpsPanel = useFinOpsStore((s) => s.setShowPanel);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { start: simStart, stop: simStop } = useSimulation(projectId);

  const {
    connected: collabConnected,
    remoteCursors,
    remoteUsers,
    syncToYjs,
    debouncedSync,
    provider: collabProvider,
  } = useCollaboration(projectId);

  useEffect(() => {
    if (projectId) getProject(projectId);
  }, [projectId, getProject]);

  useEffect(() => {
    if (currentProject?.canvas_data) {
      const cd = currentProject.canvas_data;
      if (cd.nodes?.length) setNodes(cd.nodes.map(enrichNode));
      if (cd.edges?.length) setEdges(cd.edges);
      markSaved(currentProject.updated_at);
    }
  }, [currentProject, setNodes, setEdges, markSaved]);

  const doAutoSave = useCallback(async () => {
    if (!projectId) return;
    if (useCanvasStore.getState().collabConnected) return;
    setSaving(true);
    try {
      const payload = { nodes: nodesRef.current, edges: edgesRef.current };
      const updatedAt = await saveCanvas(projectId, payload);
      markSaved(updatedAt);
    } catch { /* keep isDirty true on failure */ }
    setSaving(false);
  }, [projectId, saveCanvas, markSaved]);

  const scheduleAutoSave = useCallback(() => {
    if (useCanvasStore.getState().collabConnected) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const { isDirty: dirty, collabConnected: collab } = useCanvasStore.getState();
      if (dirty && !collab) doAutoSave();
    }, 30000);
  }, [doAutoSave]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodesRef.current));
      markDirty();
      scheduleAutoSave();
      debouncedSync();
    },
    [setNodes, markDirty, scheduleAutoSave, debouncedSync],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edgesRef.current));
      markDirty();
      scheduleAutoSave();
      debouncedSync();
    },
    [setEdges, markDirty, scheduleAutoSave, debouncedSync],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      pushUndoState();
      addEdge({
        id: `${params.source}->${params.target}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        type: "default",
        data: {
          routing: { protocol: "HTTP", isSync: true, trafficPercent: 100, requiresTLS: false },
          throughputRPS: 0, latencyMs: 0, isAnimated: false, isSaturated: false, isSecure: true,
        },
      } as Edge);
      scheduleAutoSave();
      debouncedSync();
    },
    [pushUndoState, scheduleAutoSave, debouncedSync],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => connection.source !== connection.target,
    [],
  );

  const onNodeClick = useCallback(
    (_: any, node: Node) => selectNode(node.id),
    [selectNode],
  );

  const onEdgeClick = useCallback(
    (_: any, edge: Edge) => selectEdge(edge.id),
    [selectEdge],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  const onNodeDragStop = useCallback(() => {
    pushUndoState();
    syncToYjs();
  }, [pushUndoState, syncToYjs]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!collabProvider?.awareness || !collabConnected) return;
    const rect = reactFlowWrapper.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { user } = useAuthStore.getState();
    collabProvider.awareness.setLocalStateField("cursor", { x, y });
    collabProvider.awareness.setLocalStateField("name", user?.username ?? "Anonymous");
    const idx = (user?.username?.length ?? 0) % CURSOR_COLORS.length;
    collabProvider.awareness.setLocalStateField("color", CURSOR_COLORS[idx]);
  }, [collabProvider, collabConnected]);

  const handleApplyTemplate = useCallback(
    (templateNodes: Node[], templateEdges: Edge[]) => {
      if (!reactFlowInstance) { loadTemplate(templateNodes, templateEdges); return; }
      const viewport = reactFlowInstance.getViewport();
      const wrapper = reactFlowWrapper.current;
      const w = wrapper?.clientWidth ?? 800;
      const h = wrapper?.clientHeight ?? 600;
      const cx = (w / 2 - viewport.x) / viewport.zoom;
      const cy = (h / 2 - viewport.y) / viewport.zoom;
      const offset = { x: cx - 380, y: cy - 100 };
      const { nodes: tn, edges: te } = { nodes: templateNodes, edges: templateEdges };
      const moved = tn.map((n) => ({ ...n, position: { x: n.position.x + offset.x, y: n.position.y + offset.y } }));
      loadTemplate(moved, te);
      scheduleAutoSave();
    },
    [reactFlowInstance, loadTemplate, scheduleAutoSave],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/node-type") as NodeType | "";
      if (!nodeType || !NODE_REGISTRY[nodeType]) return;
      const meta = NODE_REGISTRY[nodeType];
      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      if (!position) return;
      pushUndoState();
      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: getReactFlowType(nodeType),
        position,
        data: {
          nodeType,
          label: meta.label,
          config: meta.defaultConfig,
          simulationState: DEFAULT_SIM,
          metrics: DEFAULT_METRICS,
        },
      };
      addNode(newNode);
      scheduleAutoSave();
      debouncedSync();
    },
    [reactFlowInstance, pushUndoState, addNode, scheduleAutoSave, debouncedSync],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        if (event.shiftKey) { redo(); event.preventDefault(); }
        else { undo(); event.preventDefault(); }
      }
    },
    [undo, redo],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (isLoading && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-surface-400 border-t-green-500 rounded-full" />
      </div>
    );
  }

  if (error && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-950 text-surface-100 flex flex-col">
      <TopToolbar
        projectId={projectId}
        saving={saving}
        onStart={simStart}
        onStop={simStop}
        showSimPanel={showSimPanel}
        onToggleSimPanel={() => setShowSimPanel((v) => !v)}
        showChaosPanel={showChaosPanel}
        onToggleChaosPanel={() => setShowChaosPanel(!showChaosPanel)}
        showDeployPanel={showDeployPanel}
        onToggleDeployPanel={() => setShowDeployPanel(!showDeployPanel)}
        showSecurityPanel={showSecurityPanel}
        onToggleSecurityPanel={() => setShowSecurityPanel(!showSecurityPanel)}
        showFinOpsPanel={showFinOpsPanel}
        onToggleFinOpsPanel={() => setShowFinOpsPanel(!showFinOpsPanel)}
        collabConnected={collabConnected}
        remoteUsers={remoteUsers}
      />

      {/* 3-panel body */}
      <div className="flex-1 flex overflow-hidden">
        <NodePanel onApplyTemplate={handleApplyTemplate} />
        <div ref={reactFlowWrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver} onMouseMove={handleMouseMove}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            isValidConnection={isValidConnection}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            onNodesDelete={(deleted) => {
              deleted.forEach((n) => removeNode(n.id));
              scheduleAutoSave();
              debouncedSync();
            }}
            onEdgesDelete={(deleted) => {
              deleted.forEach((e) => removeEdge(e.id));
              scheduleAutoSave();
              debouncedSync();
            }}
          >
            <VpcBoundaries nodes={nodes} />
            <Background color="#27272a" gap={20} />
            <Controls className="bg-surface-900 border-surface-700 [&>button]:border-surface-700 [&>button]:bg-surface-800 [&>button]:hover:bg-surface-700" />
            <MiniMap
              className="border border-surface-700 rounded-lg"
              style={{ background: "#09090b" }}
              nodeColor="#27272a"
              maskColor="rgba(9,9,11,0.7)"
            />
          </ReactFlow>
          {collabConnected && remoteCursors.map((c) => (
            <div
              key={c.clientId}
              className="absolute pointer-events-none z-50"
              style={{ left: c.x, top: c.y }}
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <path d="M2 2L15 20L10.5 13.5L18 11L2 2Z" fill={c.color} stroke="white" strokeWidth="1.5" />
              </svg>
              <span
                className="absolute left-4 top-0 text-[10px] font-medium whitespace-nowrap px-1.5 py-0.5 rounded"
                style={{ background: c.color, color: "#fff" }}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>
        {showSecurityPanel ? (
          <SecurityPanel />
        ) : showFinOpsPanel ? (
          <FinOpsPanel />
        ) : showDeployPanel ? (
          <DeploymentPanel />
        ) : showChaosPanel ? (
          <ChaosPanel />
        ) : showSimPanel ? (
          <SimulationPanel onStart={simStart} onStop={simStop} />
        ) : (
          <NodeConfigPanel />
        )}
      </div>

      <ToastContainer />
      <ExportModal />
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ReactFlowProvider>
      <ProjectCanvas id={id!} />
    </ReactFlowProvider>
  );
}
