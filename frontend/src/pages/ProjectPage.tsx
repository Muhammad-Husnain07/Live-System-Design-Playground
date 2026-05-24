import { useEffect, useCallback, useRef, useState, useMemo, type DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
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
import { Sword, Trophy, Frown } from "lucide-react";
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
import DrillPanel from "../components/panels/DrillPanel";
import TopToolbar from "../components/toolbar/TopToolbar";
import ToastContainer from "../components/ui/Toast";
import { useSimulation } from "../hooks/useSimulation";
import { useCollaboration, CURSOR_COLORS } from "../hooks/useCollaboration";
import { useChaosStore } from "../store/chaosStore";
import { useDeployStore } from "../store/deploymentStore";
import { useSecurityStore } from "../store/securityStore";
import { useFinOpsStore } from "../store/finopsStore";
import { useChallengeStore } from "../store/challengeStore";
import { useSimulationStore } from "../store/simulationStore";
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

function ProgressRing({ value, size = 56, strokeWidth = 5, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

function ChallengeTimerBar({ challenge, onSubmit, submitting }: { challenge: NonNullable<ReturnType<typeof useChallengeStore.getState>["activeChallenge"]>; onSubmit: () => void; submitting: boolean }) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Date.now() - challenge.startedAt;
    return Math.max(0, challenge.timeLimitMs - elapsed);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - challenge.startedAt;
      const rem = Math.max(0, challenge.timeLimitMs - elapsed);
      setRemaining(rem);
      if (rem <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [challenge.startedAt, challenge.timeLimitMs]);

  const totalSec = Math.ceil(challenge.timeLimitMs / 1000);
  const remSec = Math.ceil(remaining / 1000);
  const progress = totalSec > 0 ? (remSec / totalSec) * 100 : 0;
  const isUrgent = remSec < 300;
  const minutes = Math.floor(remSec / 60);
  const seconds = remSec % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className={`h-10 shrink-0 flex items-center justify-between px-4 border-b ${isUrgent ? "bg-red-500/10 border-red-500/30" : "bg-surface-900 border-surface-800"}`}>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-surface-500 font-medium uppercase tracking-wider">
          <Sword className="h-4 w-4" /> {challenge.title}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={`text-xs font-mono tabular-nums font-medium ${isUrgent ? "text-red-400 animate-pulse" : "text-surface-200"}`}>
            {timeStr}
          </span>
        </div>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className={`px-3 py-1 text-[11px] font-medium rounded transition-colors disabled:opacity-50 ${submitting ? "bg-surface-700 text-surface-400" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"}`}
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin h-3 w-3 border border-blue-400 border-t-transparent rounded-full" />
              Evaluating...
            </span>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
}

function ScoreReportModal({ report, onClose }: { report: { cost: number; reliability: number; performance: number; total: number; passed: boolean }; onClose: () => void }) {
  const items = [
    { label: "Cost", value: report.cost, color: "#10b981" },
    { label: "Reliability", value: report.reliability, color: "#3b82f6" },
    { label: "Performance", value: report.performance, color: "#f59e0b" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <span className="text-3xl">{report.passed ? <Trophy className="h-4 w-4" /> : <Frown className="h-4 w-4" />}</span>
          <h3 className={`text-lg font-bold mt-2 ${report.passed ? "text-green-400" : "text-red-400"}`}>
            {report.passed ? "Challenge Passed!" : "Challenge Failed"}
          </h3>
          <p className="text-[11px] text-surface-500 mt-0.5">Total Score: <span className="text-surface-200 font-mono font-semibold">{report.total.toFixed(1)}</span></p>
        </div>

        <div className="flex justify-center gap-4 mb-4">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <ProgressRing value={item.value} color={item.color} size={56} strokeWidth={5} />
              <span className="text-[9px] uppercase tracking-wider text-surface-500 font-medium">{item.label}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: item.color }}>{item.value.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 text-[11px] font-medium bg-surface-800 hover:bg-surface-700 text-surface-200 rounded transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function ProjectCanvas({ id: projectId }: { id: string }) {
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const canvasExtent = useMemo<[[number, number], [number, number]]>(
    () => [[-10000, -10000], [10000, 10000]],
    [],
  );

  const { currentProject, isLoading, error, getProject, saveCanvas } = useProjectStore();

  const store = useCanvasStore();
  const {
    nodes, edges, isDirty,
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
  const [showDrillPanel, setShowDrillPanel] = useState(false);
  const activeChallenge = useChallengeStore((s) => s.activeChallenge);
  const submitting = useChallengeStore((s) => s.submitting);
  const scoreReport = useChallengeStore((s) => s.scoreReport);
  const submitChallenge = useChallengeStore((s) => s.submitChallenge);
  const clearActiveChallenge = useChallengeStore((s) => s.clearActiveChallenge);
  const wsStatus = useSimulationStore((s) => s.connectionStatus);
  const prevDirty = useRef(isDirty);

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
    if (projectId) {
      setNodes([]);
      setEdges([]);
      getProject(projectId);
    }
  }, [projectId, getProject, setNodes, setEdges]);

  useEffect(() => {
    if (currentProject?.canvas_data) {
      const cd = currentProject.canvas_data;
      setNodes(cd.nodes?.length ? cd.nodes.map(enrichNode) : []);
      setEdges(cd.edges?.length ? cd.edges : []);
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
    } catch {
      autoSaveTimer.current = setTimeout(() => {
        const { isDirty: dirty, collabConnected: collab } = useCanvasStore.getState();
        if (dirty && !collab) doAutoSave();
      }, 15000);
    }
    setSaving(false);
  }, [projectId, saveCanvas, markSaved]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutoSave = useCallback(() => {
    if (useCanvasStore.getState().collabConnected) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const { isDirty: dirty, collabConnected: collab } = useCanvasStore.getState();
      if (dirty && !collab) doAutoSave();
    }, 30000);
  }, [doAutoSave]);

  useEffect(() => {
    if (isDirty && !prevDirty.current) {
      scheduleAutoSave();
    }
    prevDirty.current = isDirty;
  }, [isDirty, scheduleAutoSave]);

  const flushCanvasChanges = useCallback(() => {
    if (changeTimerRef.current) { clearTimeout(changeTimerRef.current); changeTimerRef.current = null; }
    markDirty();
    scheduleAutoSave();
    debouncedSync();
  }, [markDirty, scheduleAutoSave, debouncedSync]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = useCanvasStore.getState().nodes;
      setNodes(applyNodeChanges(changes, currentNodes));
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(flushCanvasChanges, 50);
    },
    [setNodes, flushCanvasChanges],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = useCanvasStore.getState().edges;
      setEdges(applyEdgeChanges(changes, currentEdges));
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(flushCanvasChanges, 50);
    },
    [setEdges, flushCanvasChanges],
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
    scheduleAutoSave();
  }, [pushUndoState, syncToYjs, scheduleAutoSave]);

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
        style: { width: 220, height: 120 },
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
      const isCtrl = event.ctrlKey || event.metaKey;
      if (isCtrl && event.key === "z") {
        if (event.shiftKey) { redo(); event.preventDefault(); }
        else { undo(); event.preventDefault(); }
        return;
      }
      if (isCtrl && event.key === "s") {
        event.preventDefault();
        doAutoSave();
        return;
      }
      if (isCtrl && event.shiftKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        if (useSimulationStore.getState().isRunning) simStop();
        else simStart();
        return;
      }
      if (event.key === "Escape") {
        selectNode(null);
        selectEdge(null);
        return;
      }
    },
    [undo, redo, doAutoSave, simStart, simStop, selectNode, selectEdge],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    };
  }, []);

  if (isLoading && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="space-y-4 w-80">
          <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 space-y-3">
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "70%", height: 16 }} />
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "90%", height: 10 }} />
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "60%", height: 10 }} />
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 space-y-3">
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "50%", height: 16 }} />
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "80%", height: 10 }} />
            <div className="bg-surface-800 rounded animate-pulse" style={{ width: "70%", height: 10 }} />
          </div>
        </div>
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
        showDrillPanel={showDrillPanel}
        onToggleDrillPanel={() => setShowDrillPanel(!showDrillPanel)}
        collabConnected={collabConnected}
        remoteUsers={remoteUsers}
      />

      {/* Challenge mode bar */}
      {activeChallenge && (
        <ChallengeTimerBar
          challenge={activeChallenge}
          onSubmit={() => submitChallenge(activeChallenge.id, activeChallenge.projectId)}
          submitting={submitting}
        />
      )}

      {/* WS reconnect banner */}
      {wsStatus === "disconnected" && useSimulationStore.getState().isRunning && (
        <div className="h-8 shrink-0 flex items-center justify-center bg-orange-500/10 border-b border-orange-500/30 gap-2">
          <span className="animate-spin h-3 w-3 border border-orange-400 border-t-transparent rounded-full" />
          <span className="text-[10px] text-orange-400 font-medium">Connection lost. Reconnecting...</span>
        </div>
      )}
      {wsStatus === "error" && !useSimulationStore.getState().isRunning && (
        <div className="h-8 shrink-0 flex items-center justify-center bg-red-500/10 border-b border-red-500/30">
          <span className="text-[10px] text-red-400 font-medium">WebSocket connection failed</span>
        </div>
      )}

      {/* ScoreReport modal */}
      {scoreReport && (
        <ScoreReportModal
          report={scoreReport}
          onClose={clearActiveChallenge}
        />
      )}

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
            elevateNodesOnSelect
            nodeExtent={canvasExtent}
            translateExtent={canvasExtent}
            snapToGrid
            snapGrid={[16, 16]}
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
            <Controls className="[&>button]:!bg-surface-800 [&>button]:!border-surface-700 [&>button]:!text-surface-400 hover:[&>button]:!bg-surface-700 [&>button]:!shadow-none !bg-transparent !border-0 !shadow-none !flex-col-reverse" />
            <MiniMap
              className="!border !border-surface-700 !rounded-lg overflow-hidden"
              style={{ background: "#09090b" }}
              nodeColor={(n) => {
                const nt = (n.data as any)?.nodeType;
                const meta = nt ? (NODE_REGISTRY as any)[nt] : null;
                return meta?.color ?? "#27272a";
              }}
              maskColor="rgba(9,9,11,0.85)"
              nodeStrokeWidth={2}
            />
            <Panel position="bottom-left">
              <div className="flex items-center gap-2 text-[10px] text-surface-600 font-mono bg-surface-950/80 backdrop-blur-sm px-2.5 py-1 rounded border border-surface-800 pointer-events-auto">
                <span>Nodes: {nodes.length}</span>
                <span className="text-surface-700">|</span>
                <span>Edges: {edges.length}</span>
              </div>
            </Panel>
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
          {nodes.length === 0 && !isLoading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-800 flex items-center justify-center">
                  <span className="text-surface-500 text-xl">+</span>
                </div>
                <p className="text-sm text-surface-500 mb-1">Empty canvas</p>
                <p className="text-[11px] text-surface-600">Drag nodes from the left panel to start designing</p>
              </div>
            </div>
          )}
        </div>
        {showSecurityPanel ? (
          <SecurityPanel />
        ) : showFinOpsPanel ? (
          <FinOpsPanel />
        ) : showDeployPanel ? (
          <DeploymentPanel />
        ) : showChaosPanel ? (
          <ChaosPanel />
        ) : showDrillPanel ? (
          <DrillPanel />
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
