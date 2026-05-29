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
import { Box, Typography, Button } from "@mui/material";

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
  retryCount: 0, droppedRequests: 0, cacheHitRatio: 0, connectionPoolMax: 100,
  coldStartMs: 500, diskIOPSMax: 3000, isPrimaryDB: false, activeConnections: 0,
  desiredInstances: 0, scalingEvent: "", staleReadCount: 0, isSplitBrain: false,
  dataInconsistency: 0, spotInterrupted: false,
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
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
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
    <Box sx={{ height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, borderBottom: "1px solid", borderColor: isUrgent ? "rgba(239,68,68,0.3)" : "#27272a", bgcolor: isUrgent ? "rgba(239,68,68,0.1)" : "#18181b" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography sx={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", display: "flex", alignItems: "center", gap: 0.5 }}>
          <Sword size={16} /> {challenge.title}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 80, height: 6, bgcolor: "#27272a", borderRadius: "9999px", overflow: "hidden" }}>
            <Box sx={{ height: "100%", borderRadius: "9999px", transition: "all 1s", bgcolor: isUrgent ? "#ef4444" : "#3b82f6", width: `${progress}%` }} />
          </Box>
          <Typography sx={{ fontSize: "12px", fontFamily: '"ui-monospace", "SFMono-Regular", monospace', fontVariantNumeric: "tabular-nums", fontWeight: 500, "@keyframes pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: isUrgent ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : "none", color: isUrgent ? "#ef4444" : "#f4f4f5" }}>
            {timeStr}
          </Typography>
        </Box>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          sx={{ px: "12px", py: "4px", fontSize: "11px", fontWeight: 500, borderRadius: "4px", minWidth: "unset", lineHeight: 1.6, bgcolor: submitting ? "#3f3f46" : "rgba(59,130,246,0.2)", color: submitting ? "#a1a1aa" : "#60a5fa", "&:hover": { bgcolor: submitting ? "#3f3f46" : "rgba(59,130,246,0.3)" }, "&.Mui-disabled": { opacity: 0.5 } }}
        >
          {submitting ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Box component="span" sx={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } }, animation: "spin 1s linear infinite", height: 12, width: 12, border: "1px solid", borderColor: "#60a5fa", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
              Evaluating...
            </Box>
          ) : (
            "Submit"
          )}
        </Button>
      </Box>
    </Box>
  );
}

function ScoreReportModal({ report, onClose }: { report: { cost: number; reliability: number; performance: number; total: number; passed: boolean }; onClose: () => void }) {
  const items = [
    { label: "Cost", value: report.cost, color: "#10b981" },
    { label: "Reliability", value: report.reliability, color: "#3b82f6" },
    { label: "Performance", value: report.performance, color: "#f59e0b" },
  ];

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <Box sx={{ bgcolor: "#18181b", border: "1px solid", borderColor: "#3f3f46", borderRadius: "12px", p: 3, width: 320, boxShadow: 24 }} onClick={(e) => e.stopPropagation()}>
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Typography component="span" sx={{ fontSize: "30px", lineHeight: 1.2 }}>{report.passed ? <Trophy size={16} /> : <Frown size={16} />}</Typography>
          <Typography sx={{ fontSize: "18px", fontWeight: 700, mt: 1, color: report.passed ? "#22c55e" : "#ef4444" }}>
            {report.passed ? "Challenge Passed!" : "Challenge Failed"}
          </Typography>
          <Typography sx={{ fontSize: "11px", mt: 0.25, color: "#71717a" }}>
            Total Score: <Box component="span" sx={{ fontFamily: '"ui-monospace", "SFMono-Regular", monospace', fontWeight: 600, color: "#f4f4f5" }}>{report.total.toFixed(1)}</Box>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
          {items.map((item) => (
            <Box key={item.label} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
              <ProgressRing value={item.value} color={item.color} size={56} strokeWidth={5} />
              <Typography sx={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a" }}>{item.label}</Typography>
              <Typography sx={{ fontSize: "12px", fontFamily: '"ui-monospace", "SFMono-Regular", monospace', fontWeight: 600, color: item.color }}>{item.value.toFixed(1)}</Typography>
            </Box>
          ))}
        </Box>

        <Button
          onClick={onClose}
          fullWidth
          sx={{ py: 1, fontSize: "11px", fontWeight: 500, bgcolor: "#27272a", color: "#f4f4f5", "&:hover": { bgcolor: "#3f3f46" }, borderRadius: "4px", textTransform: "none" }}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Box>
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
    pushUndoState, undo, redo, addEdge,
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
    }, 3000);
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
      <Box sx={{ height: "100vh", bgcolor: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: 320 }}>
          <Box sx={{ bgcolor: "#18181b", border: "1px solid", borderColor: "#27272a", borderRadius: "8px", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "70%", height: 16, "@keyframes pulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "90%", height: 10, "@keyframes pulse2": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse2 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "60%", height: 10, "@keyframes pulse3": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse3 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
          </Box>
          <Box sx={{ bgcolor: "#18181b", border: "1px solid", borderColor: "#27272a", borderRadius: "8px", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "50%", height: 16, "@keyframes pulse4": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse4 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "80%", height: 10, "@keyframes pulse5": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse5 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "70%", height: 10, "@keyframes pulse6": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } }, animation: "pulse6 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (error && !currentProject) {
    return (
      <Box sx={{ height: "100vh", bgcolor: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: "14px", mb: 0.5, color: "#ef4444" }}>{error}</Typography>
          <Button onClick={() => navigate("/dashboard")} sx={{ fontSize: "14px", color: "#60a5fa", textTransform: "none", minWidth: "unset", p: 0, "&:hover": { bgcolor: "transparent", opacity: 0.8 } }}>
            Back to Dashboard
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", bgcolor: "#09090b", display: "flex", flexDirection: "column", color: "#f4f4f5" }}>
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

      {activeChallenge && (
        <ChallengeTimerBar
          challenge={activeChallenge}
          onSubmit={() => submitChallenge(activeChallenge.id, activeChallenge.projectId)}
          submitting={submitting}
        />
      )}

      {wsStatus === "disconnected" && useSimulationStore.getState().isRunning && (
        <Box sx={{ height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(249,115,22,0.1)", borderBottom: "1px solid rgba(249,115,22,0.3)", gap: 1 }}>
          <Box component="span" sx={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } }, animation: "spin 1s linear infinite", height: 12, width: 12, border: "1px solid", borderColor: "#fb923c", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
          <Typography sx={{ fontSize: "10px", fontWeight: 500, color: "#fb923c" }}>Connection lost. Reconnecting...</Typography>
        </Box>
      )}
      {wsStatus === "error" && !useSimulationStore.getState().isRunning && (
        <Box sx={{ height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
          <Typography sx={{ fontSize: "10px", fontWeight: 500, color: "#ef4444" }}>WebSocket connection failed</Typography>
        </Box>
      )}

      {scoreReport && (
        <ScoreReportModal
          report={scoreReport}
          onClose={clearActiveChallenge}
        />
      )}

      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <NodePanel />
        <Box ref={reactFlowWrapper} sx={{ flex: 1, position: "relative" }} onDrop={onDrop} onDragOver={onDragOver} onMouseMove={handleMouseMove}>
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
            <Box sx={{
              "& .react-flow__controls": {
                background: "transparent !important",
                border: "none !important",
                boxShadow: "none !important",
                display: "flex !important",
                flexDirection: "column-reverse !important",
              },
              "& .react-flow__controls-button": {
                background: "#27272a !important",
                border: "1px solid #3f3f46 !important",
                boxShadow: "none !important",
                "&:hover": {
                  background: "#3f3f46 !important",
                },
              },
            }}>
              <Controls />
            </Box>
            <MiniMap
              style={{
                background: "#09090b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                overflow: "hidden",
              }}
              nodeColor={(n) => {
                const nt = (n.data as any)?.nodeType;
                const meta = nt ? (NODE_REGISTRY as any)[nt] : null;
                return meta?.color ?? "#27272a";
              }}
              maskColor="rgba(9,9,11,0.85)"
              nodeStrokeWidth={2}
            />
            <Panel position="bottom-left">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "10px", fontFamily: '"ui-monospace", "SFMono-Regular", monospace', bgcolor: "rgba(9,9,11,0.8)", backdropFilter: "blur(4px)", px: "10px", py: "4px", borderRadius: "4px", border: "1px solid", borderColor: "#27272a", pointerEvents: "auto", color: "#52525b" }}>
                <Typography component="span" sx={{ fontSize: "inherit", fontFamily: "inherit" }}>Nodes: {nodes.length}</Typography>
                <Typography component="span" sx={{ fontSize: "inherit", color: "#3f3f46" }}>|</Typography>
                <Typography component="span" sx={{ fontSize: "inherit", fontFamily: "inherit" }}>Edges: {edges.length}</Typography>
              </Box>
            </Panel>
          </ReactFlow>
          {collabConnected && remoteCursors.map((c) => (
            <Box
              key={c.clientId}
              sx={{ position: "absolute", pointerEvents: "none", zIndex: 50, left: c.x, top: c.y }}
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <path d="M2 2L15 20L10.5 13.5L18 11L2 2Z" fill={c.color} stroke="white" strokeWidth="1.5" />
              </svg>
              <Typography
                component="span"
                sx={{ position: "absolute", left: 16, top: 0, fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap", px: "6px", py: "2px", borderRadius: "4px", bgcolor: c.color, color: "#fff" }}
              >
                {c.name}
              </Typography>
            </Box>
          ))}
          {nodes.length === 0 && !isLoading && (
            <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box sx={{ textAlign: "center" }}>
                <Box sx={{ width: 56, height: 56, mx: "auto", mb: 1.5, borderRadius: "50%", bgcolor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography component="span" sx={{ fontSize: "20px", lineHeight: 1, color: "#71717a" }}>+</Typography>
                </Box>
                <Typography sx={{ fontSize: "14px", mb: 0.5, color: "#71717a" }}>Empty canvas</Typography>
                <Typography sx={{ fontSize: "11px", color: "#52525b" }}>Drag nodes from the left panel to start designing</Typography>
              </Box>
            </Box>
          )}
        </Box>
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
      </Box>

      <ToastContainer />
      <ExportModal />
    </Box>
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
