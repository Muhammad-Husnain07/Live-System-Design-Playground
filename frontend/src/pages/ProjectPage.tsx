import { useEffect, useCallback, useRef, useState, type DragEvent } from "react";
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
import type { NodeType, NodeMetrics, SimulationNodeState } from "../types/canvas";

const DEFAULT_SIM: SimulationNodeState = {
  status: "healthy", uptimeSeconds: 0, lastFailure: null, failureCount: 0,
};

const DEFAULT_METRICS: NodeMetrics = {
  currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0,
  errorCount: 0, p99LatencyMs: 0, canaryRPS: 0,
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
    nodes, edges, isDirty, lastSaved, pastStates, futureStates,
    setNodes, setEdges, addNode, removeNode, removeEdge,
    selectNode, selectEdge, markDirty, markSaved,
    pushUndoState, undo, redo, addEdge, loadTemplate,
  } = store;

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSaving(true);
    try {
      const payload = { nodes: nodesRef.current, edges: edgesRef.current };
      const updatedAt = await saveCanvas(projectId, payload);
      markSaved(updatedAt);
    } catch { /* keep isDirty true on failure */ }
    setSaving(false);
  }, [projectId, saveCanvas, markSaved]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const { isDirty: dirty } = useCanvasStore.getState();
      if (dirty) doAutoSave();
    }, 30000);
  }, [doAutoSave]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodesRef.current));
      markDirty();
      scheduleAutoSave();
    },
    [setNodes, markDirty, scheduleAutoSave],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edgesRef.current));
      markDirty();
      scheduleAutoSave();
    },
    [setEdges, markDirty, scheduleAutoSave],
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
    },
    [pushUndoState, scheduleAutoSave],
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
  }, [pushUndoState]);

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
    },
    [reactFlowInstance, pushUndoState, addNode, scheduleAutoSave],
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

  const saveIndicator = saving ? "Saving..." : isDirty ? "Unsaved changes" : lastSaved ? "Saved ✓" : "";

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
      {/* Top Toolbar */}
      <header className="border-b border-surface-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-sm text-surface-400 hover:text-surface-200 transition-colors">
            &larr; Dashboard
          </button>
          <h1 className="text-sm font-medium">{currentProject?.name || "Project"}</h1>
          {currentProject?.role && (
            <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded">
              {currentProject.role}
            </span>
          )}
          {/* Save indicator */}
          <span className={`text-[10px] ${saving ? "text-yellow-400" : isDirty ? "text-orange-400" : "text-green-500"}`}>
            {saveIndicator}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={pastStates.length === 0}
            title="Undo (Ctrl+Z)"
            className="px-2 py-1 text-xs bg-surface-800 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={futureStates.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            className="px-2 py-1 text-xs bg-surface-800 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
          >
            ↪
          </button>

          <button
            onClick={() => navigate(`/project/${projectId}/observe`)}
            className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            Observability
          </button>
        </div>
      </header>

      {/* 3-panel body */}
      <div className="flex-1 flex overflow-hidden">
        <NodePanel onApplyTemplate={handleApplyTemplate} />
        <div ref={reactFlowWrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
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
            }}
            onEdgesDelete={(deleted) => {
              deleted.forEach((e) => removeEdge(e.id));
              scheduleAutoSave();
            }}
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
        <NodeConfigPanel />
      </div>
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
