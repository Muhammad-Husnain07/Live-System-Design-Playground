import { memo, useEffect, useCallback, useRef, useState, useMemo, type DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background, BackgroundVariant,
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
import { Sword } from "lucide-react";
import { useProjectStore } from "../store/projectStore";
import { useCanvasStore } from "../store/canvasStore";
import { useShallow } from "zustand/react/shallow";
import { nodeTypes, edgeTypes, getReactFlowType } from "../components/canvas/nodeTypes";
import { NODE_REGISTRY } from "../utils/nodeRegistry";
import TopToolbar from "../components/toolbar/TopToolbar";
import ToastContainer from "../components/ui/Toast";
import { useSimulation } from "../hooks/useSimulation";
import { useCollaboration, CURSOR_COLORS } from "../hooks/useCollaboration";
import { useChallengeStore } from "../store/challengeStore";
import { useDeployStore } from "../store/deploymentStore";
import { useExportStore } from "../store/exportStore";
import { useSimulationStore } from "../store/simulationStore";
import { useAuthStore } from "../store/authStore";
import MaturityModal from "../components/panels/MaturityModal";
import ArchitectureInsightsPanel from "../components/panels/ArchitectureInsightsPanel";
import ExportModal from "../components/panels/ExportModal";
import FinOpsModal from "../components/panels/FinOpsModal";
import ChaosPanel from "../components/panels/ChaosPanel";
import SecurityPanel from "../components/panels/SecurityPanel";
import DeploymentPanel from "../components/panels/DeploymentPanel";
import FloatingFeaturePanel from "../components/panels/FloatingFeaturePanel";
import ActionDock, { type PanelId } from "../components/toolbar/ActionDock";
import CommandPalette from "../components/ui/CommandPalette";
import {
  SIMULATION_ACTIONS, PANEL_ACTIONS, HISTORY_ACTIONS, EXPORT_ACTIONS,
  type CommandAction,
} from "../utils/commandActions";
import { useChaosStore, CHAOS_TYPES } from "../store/chaosStore";
import { useToastStore } from "../store/toastStore";
import api from "../utils/api";
import { ENTERPRISE_TEMPLATES, DEFAULT_SIM, DEFAULT_METRICS } from "../utils/enterpriseTemplates";
import type { NodeType } from "../types/canvas";
import RadialMenu from "../components/canvas/RadialMenu";
import FloatingInspector from "../components/panels/FloatingInspector";
import ComponentSpawner from "../components/canvas/ComponentSpawner";
import HeatmapOverlay from "../components/canvas/HeatmapOverlay";
import DeepDiveChart from "../components/panels/DeepDiveChart";
import StatusBar from "../components/toolbar/StatusBar";
import QuakeTerminal from "../components/ui/QuakeTerminal";
import { Box, Typography, Button } from "@mui/material";
import { spatialTokens } from "../theme/spatialTokens";

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
          rx={12} ry={12}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

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
    <Box sx={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: spatialTokens.z.floatingPanels, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, borderRadius: "8px", backdropFilter: "blur(12px)", border: "1px solid", borderColor: isUrgent ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)", bgcolor: isUrgent ? "rgba(239,68,68,0.12)" : "rgba(5,5,7,0.7)", gap: 1.5, minWidth: 300, pointerEvents: "auto" }}>
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
    <Box sx={{ position: "fixed", inset: 0, zIndex: spatialTokens.z.modals, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <Box sx={{ bgcolor: "#18181b", border: "1px solid", borderColor: "#3f3f46", borderRadius: "12px", p: 3, width: 320, boxShadow: 24 }} onClick={(e) => e.stopPropagation()}>
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Box sx={{ fontSize: "30px", lineHeight: 1.2, mb: 1 }}>{report.passed ? "&#10003;" : "&#10007;"}</Box>
          <Typography sx={{ fontSize: "18px", fontWeight: 700, color: report.passed ? "#22c55e" : "#ef4444" }}>
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

const ProjectCanvas = memo(function ProjectCanvas({ id: projectId }: { id: string }) {
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const canvasExtent = useMemo<[[number, number], [number, number]]>(
    () => [[0, 0], [5000, 5000]],
    [],
  );

  const { currentProject, isLoading, error, getProject, saveCanvas } = useProjectStore(useShallow((s) => ({ currentProject: s.currentProject, isLoading: s.isLoading, error: s.error, getProject: s.getProject, saveCanvas: s.saveCanvas })));

  const { nodes, edges, isDirty, setNodes, setEdges, addNode, removeNode, removeEdge, selectNode, selectEdge, markDirty, markSaved, pushUndoState, undo, redo, addEdge, setActiveRightTab } = useCanvasStore(useShallow((s) => ({ nodes: s.nodes, edges: s.edges, isDirty: s.isDirty, setNodes: s.setNodes, setEdges: s.setEdges, addNode: s.addNode, removeNode: s.removeNode, removeEdge: s.removeEdge, selectNode: s.selectNode, selectEdge: s.selectEdge, markDirty: s.markDirty, markSaved: s.markSaved, pushUndoState: s.pushUndoState, undo: s.undo, redo: s.redo, addEdge: s.addEdge, setActiveRightTab: s.setActiveRightTab })));

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [chaosFlash, setChaosFlash] = useState(false);
  const lastChaosInjectionAt = useChaosStore((s) => s.lastChaosInjectionAt);
  const storeShowChaos = useChaosStore((s) => s.showChaosPanel);
  const storeShowDeploy = useDeployStore((s) => s.showDeployPanel);

  /* Sync store-level show flags → activePanel (intentional: zustand → local state bridge) */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storeShowChaos && activePanel !== "chaos") setActivePanel("chaos");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storeShowDeploy && activePanel !== "deploy") setActivePanel("deploy");
  }, [storeShowChaos, storeShowDeploy]);

  useEffect(() => {
    if (lastChaosInjectionAt > 0) {
      setChaosFlash(true);
      const t = setTimeout(() => setChaosFlash(false), 350);
      return () => clearTimeout(t);
    }
  }, [lastChaosInjectionAt]);

  const [saving, setSaving] = useState(false);
  const setExportMode = useCanvasStore((s) => s.setExportMode);

  useEffect(() => {
    setExportMode(activePanel === "export");
  }, [activePanel, setExportMode]);


  const [showMaturityPanel, setShowMaturityPanel] = useState(false);
  const onToggleMaturityPanel = useCallback(() => setShowMaturityPanel((v) => !v), []);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const onToggleInsightsPanel = useCallback(() => setShowInsightsPanel((v) => !v), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [deepDiveNodeId, setDeepDiveNodeId] = useState<string | null>(null);
  const reactFlowRef = useRef<any>(null);
  useEffect(() => { reactFlowRef.current = reactFlowInstance; }, [reactFlowInstance]);
  const activeChallenge = useChallengeStore((s) => s.activeChallenge);
  const submitting = useChallengeStore((s) => s.submitting);
  const scoreReport = useChallengeStore((s) => s.scoreReport);
  const submitChallenge = useChallengeStore((s) => s.submitChallenge);
  const clearActiveChallenge = useChallengeStore((s) => s.clearActiveChallenge);
  const wsStatus = useSimulationStore((s) => s.connectionStatus);
  const prevDirty = useRef(isDirty);

  const { start: simStartBase, stop: simStop } = useSimulation(projectId);
  const simStart = useCallback(() => {
    setActiveRightTab("simulate");
    simStartBase();
  }, [simStartBase, setActiveRightTab]);

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
        type: "smoothstep",
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
    (_: any, node: Node) => {
      selectNode(node.id);
      setActiveRightTab("config");
    },
    [selectNode, setActiveRightTab],
  );

  const onEdgeClick = useCallback(
    (_: any, edge: Edge) => {
      selectEdge(edge.id);
      setActiveRightTab("config");
    },
    [selectEdge, setActiveRightTab],
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setDeepDiveNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
    setContextMenu(null);
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
      setIsDraggingOver(false);
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
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const paletteActions = useMemo<CommandAction[]>(() => {
    const nodeActions: CommandAction[] = Object.entries(NODE_REGISTRY).map(([nodeType, meta]) => ({
      id: `add-node-${nodeType}`,
      label: `Add Node: ${meta.label}`,
      searchTerms: [meta.category, nodeType, ...meta.label.split(" ")],
      category: "Nodes",
    }));
    const chaosActions: CommandAction[] = CHAOS_TYPES.map((ct) => ({
      id: `inject-chaos-${ct.type}`,
      label: `Inject Chaos: ${ct.label}`,
      searchTerms: [ct.type, ct.label, "chaos", ...ct.label.split(" ")],
      category: "Chaos",
    }));
    return [...nodeActions, ...SIMULATION_ACTIONS, ...chaosActions, ...PANEL_ACTIONS, ...HISTORY_ACTIONS, ...EXPORT_ACTIONS];
  }, []);

  const handlePaletteExecute = useCallback(
    (actionId: string) => {
      const toast = useToastStore.getState().addToast;
      const cs = useCanvasStore.getState;
      const sim = useSimulationStore.getState;

      if (actionId.startsWith("add-node-")) {
        const nodeType = actionId.replace("add-node-", "") as NodeType;
        const meta = NODE_REGISTRY[nodeType];
        if (!meta) return;
        const wrapper = reactFlowWrapper.current;
        const rf = reactFlowRef.current;
        let x = 300, y = 200;
        if (rf && wrapper) {
          const center = rf.screenToFlowPosition({ x: wrapper.clientWidth / 2, y: wrapper.clientHeight / 3 });
          x = center.x;
          y = center.y;
        }
        const newNode: Node = {
          id: `${nodeType}-${Date.now()}`,
          type: getReactFlowType(nodeType),
          position: { x, y },
          style: { width: 220, height: 120 },
          data: {
            nodeType,
            label: meta.label,
            config: meta.defaultConfig,
            simulationState: DEFAULT_SIM,
            metrics: DEFAULT_METRICS,
          },
        };
        cs().pushUndoState();
        cs().addNode(newNode);
        scheduleAutoSave();
        debouncedSync();
        toast({ type: "success", title: `Node added`, message: meta.label, duration: 2500 });
        return;
      }

      if (actionId === "start-simulation") {
        simStart();
        toast({ type: "info", title: "Simulation starting\u2026", duration: 2000 });
        return;
      }
      if (actionId === "stop-simulation") {
        simStop();
        toast({ type: "info", title: "Simulation stopped", duration: 2000 });
        return;
      }

      if (actionId.startsWith("inject-chaos-")) {
        const eventType = actionId.replace("inject-chaos-", "");
        const label = CHAOS_TYPES.find((c) => c.type === eventType)?.label ?? eventType;
        const runId = sim().runId;
        const selectedNodeId = cs().selectedNodeId;
        if (!runId) {
          toast({ type: "warning", title: "Start a simulation first", duration: 3000 });
          return;
        }
        if (!selectedNodeId) {
          toast({ type: "warning", title: "Select a node to target", duration: 3000 });
          return;
        }
        api.post("/simulations/chaos/inject", {
          simulationRunId: runId,
          nodeId: selectedNodeId,
          eventType,
          severity: 0.5,
          durationSeconds: 30,
        }).then(() => {
          toast({ type: "success", title: `${label} injected`, duration: 2500 });
          useChaosStore.getState().setLastChaosInjectionAt(Date.now());
        }).catch(() => {
          toast({ type: "error", title: `Failed to inject ${label}`, duration: 3000 });
        });
        return;
      }

      if (actionId === "toggle-chaos") {
        setActivePanel((prev) => prev === "chaos" ? null : "chaos");
        cs().setActiveRightTab("simulate");
        toast({ type: "info", title: "Chaos panel toggled", duration: 2000 });
        return;
      }
      if (actionId === "toggle-deploy") {
        const v = !useDeployStore.getState().showDeployPanel;
        useDeployStore.getState().setShowDeployPanel(v);
        cs().setActiveRightTab("deploy");
        toast({ type: "info", title: v ? "Deploy panel opened" : "Deploy panel closed", duration: 2000 });
        return;
      }
      if (actionId === "toggle-security") {
        setActivePanel((prev) => prev === "security" ? null : "security");
        cs().setActiveRightTab("security");
        toast({ type: "info", title: "Security panel toggled", duration: 2000 });
        return;
      }
      if (actionId === "toggle-finops") {
        setActivePanel((prev) => prev === "finops" ? null : "finops");
        cs().setActiveRightTab("finops");
        toast({ type: "info", title: "FinOps panel toggled", duration: 2000 });
        return;
      }
      if (actionId === "open-export") {
        setActivePanel("export");
        toast({ type: "info", title: "Export panel opened", duration: 2000 });
        return;
      }

      if (actionId === "undo") {
        cs().undo();
        toast({ type: "info", title: "Undo", duration: 1500 });
        return;
      }
      if (actionId === "redo") {
        cs().redo();
        toast({ type: "info", title: "Redo", duration: 1500 });
        return;
      }

      if (actionId === "export-terraform") {
        const es = useExportStore.getState();
        es.setFormat("terraform");
        es.openExport();
        toast({ type: "info", title: "Export Terraform", duration: 2000 });
        return;
      }
      if (actionId === "export-kubernetes") {
        const es = useExportStore.getState();
        es.setFormat("kubernetes");
        es.openExport();
        toast({ type: "info", title: "Export Kubernetes", duration: 2000 });
        return;
      }
      if (actionId === "export-cloudformation") {
        const es = useExportStore.getState();
        es.setFormat("cloudformation");
        es.openExport();
        toast({ type: "info", title: "Export CloudFormation", duration: 2000 });
        return;
      }
    },
    [simStart, simStop, scheduleAutoSave, debouncedSync, setActivePanel],
  );

  const allTemplates = ENTERPRISE_TEMPLATES;

  const applyTemplate = useCallback((templateId: string) => {
    const tpl = allTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    const wrapper = reactFlowWrapper.current;
    const rf = reactFlowRef.current;
    let ox = 100, oy = 100;
    if (rf && wrapper) {
      const center = rf.screenToFlowPosition({ x: wrapper.clientWidth / 2, y: wrapper.clientHeight / 3 });
      ox = center.x - 380;
      oy = center.y - 100;
    }
    const { nodes: tNodes, edges: tEdges = [] } = tpl.build(ox, oy);
    const cs = useCanvasStore.getState();
    cs.pushUndoState();
    tNodes.forEach(n => cs.addNode(n));
    tEdges.forEach(e => cs.addEdge(e));
    scheduleAutoSave();
    debouncedSync();
    useToastStore.getState().addToast({ type: "success", title: `Template applied`, message: tpl.label, duration: 2500 });
  }, [allTemplates, scheduleAutoSave, debouncedSync]);

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
      if (event.key === "`" || event.key === "~" || (isCtrl && event.key === " ")) {
        event.preventDefault();
        setTerminalOpen((v) => !v);
        return;
      }
      if (isCtrl && event.key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (isCtrl && event.shiftKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        if (useSimulationStore.getState().isRunning) simStop();
        else simStart();
        return;
      }
      const isInput = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || (document.activeElement as HTMLElement).isContentEditable);
      if ((event.key === "Delete" || event.key === "Backspace") && !isInput) {
        const st = useCanvasStore.getState();
        if (st.selectedNodeId) { pushUndoState(); removeNode(st.selectedNodeId); }
        else if (st.selectedEdgeId) { pushUndoState(); removeEdge(st.selectedEdgeId); }
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") {
        if (terminalOpen) {
          setTerminalOpen(false);
          return;
        }
        selectNode(null);
        selectEdge(null);
        return;
      }
    },
    [undo, redo, doAutoSave, simStart, simStop, selectNode, selectEdge, pushUndoState, removeNode, removeEdge, terminalOpen],
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
      <Box sx={{ height: "100vh", bgcolor: spatialTokens.bg.void, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: 320 }}>
          <Box className="floating-island" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "70%", height: 16 }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "90%", height: 10 }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "60%", height: 10 }} />
          </Box>
          <Box className="floating-island" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "50%", height: 16 }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "80%", height: 10 }} />
            <Box sx={{ bgcolor: "#27272a", borderRadius: "4px", width: "70%", height: 10 }} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (error && !currentProject) {
    return (
      <Box sx={{ height: "100vh", bgcolor: spatialTokens.bg.void, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: "14px", mb: 0.5, color: spatialTokens.accent.error }}>{error}</Typography>
          <Button onClick={() => navigate("/dashboard")} sx={{ fontSize: "14px", color: spatialTokens.accent.primary, textTransform: "none", minWidth: "unset", p: 0, "&:hover": { bgcolor: "transparent", opacity: 0.8 } }}>
            Back to Dashboard
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", bgcolor: spatialTokens.bg.void, overflow: "hidden", color: spatialTokens.text.primary, position: "relative" }}>
      {/* Fullscreen canvas fills entire viewport */}
      <Box ref={reactFlowWrapper} sx={{ width: "100%", height: "100vh", position: "relative", cursor: isDraggingOver ? "crosshair" : undefined,
        "& .react-flow": isDraggingOver ? { boxShadow: "inset 0 0 60px rgba(34,197,94,0.08)", transition: "box-shadow 0.15s" } : {},
      }} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onMouseMove={handleMouseMove}>
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
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          isValidConnection={isValidConnection}
          fitView
          panOnScroll
          elevateNodesOnSelect
          nodeExtent={canvasExtent}
          translateExtent={canvasExtent}
          onlyRenderVisibleElements
          snapToGrid
          snapGrid={[16, 16]}
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
          <Background variant={BackgroundVariant.Dots} gap={40} size={1.5} color="rgba(255,255,255,0.05)" />
          <VpcBoundaries nodes={nodes} />
          <HeatmapOverlay nodes={nodes} />

          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: spatialTokens.z.canvasControls,
            background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(5,5,7,0.6) 100%)",
          }} />

          <Controls />
          <MiniMap
            style={{
              background: spatialTokens.bg.island,
              border: spatialTokens.border.island,
              borderRadius: "10px",
              overflow: "hidden",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              boxShadow: spatialTokens.shadow.island,
            }}
            nodeColor={(n) => {
              const nt = (n.data as any)?.nodeType;
              const meta = nt ? (NODE_REGISTRY as any)[nt] : null;
              return meta?.color ?? "#27272a";
            }}
            maskColor="rgba(5,5,7,0.8)"
            nodeStrokeWidth={2}
          />

          {/* Floating node/edge count */}
          <Box sx={{ position: "absolute", bottom: 16, left: 16, zIndex: spatialTokens.z.canvasControls, pointerEvents: "auto" }}>
            <Box className="floating-island" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.5, fontSize: "10px", fontFamily: spatialTokens.font.mono, color: spatialTokens.text.secondary }}>
              <Typography component="span" sx={{ fontSize: "inherit", fontFamily: "inherit" }}>Nodes: {nodes.length}</Typography>
              <Typography component="span" sx={{ fontSize: "inherit", color: spatialTokens.text.placeholder }}>|</Typography>
              <Typography component="span" sx={{ fontSize: "inherit", fontFamily: "inherit" }}>Edges: {edges.length}</Typography>
            </Box>
          </Box>
        </ReactFlow>

        {collabConnected && remoteCursors.map((c) => (
          <Box key={c.clientId} sx={{ position: "absolute", pointerEvents: "none", zIndex: 50, left: c.x, top: c.y }}>
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M2 2L15 20L10.5 13.5L18 11L2 2Z" fill={c.color} stroke="white" strokeWidth="1.5" />
            </svg>
            <Typography component="span" sx={{ position: "absolute", left: 16, top: 0, fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap", px: "6px", py: "2px", borderRadius: "4px", bgcolor: c.color, color: "#fff" }}>
              {c.name}
            </Typography>
          </Box>
        ))}

        {nodes.length === 0 && !isLoading && (
          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Box sx={{ textAlign: "center", maxWidth: 420, zIndex: 10 }}>
              <Box sx={{ width: 64, height: 64, mx: "auto", mb: 2, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography component="span" sx={{ fontSize: "24px", lineHeight: 1, color: "#22c55e" }}>&#9678;</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontSize: "18px", fontWeight: 600, color: "#f4f4f5", mb: 0.5 }}>
                Start Designing Your System
              </Typography>
              <Typography variant="body1" sx={{ fontSize: "12px", color: "#71717a", mb: 2.5, lineHeight: 1.5 }}>
                Press <Box component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', bgcolor: "rgba(255,255,255,0.06)", px: 0.6, py: 0.15, borderRadius: "3px", fontSize: "0.6rem" }}>+</Box> or <Box component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', bgcolor: "rgba(255,255,255,0.06)", px: 0.6, py: 0.15, borderRadius: "3px", fontSize: "0.6rem" }}>Ctrl+K</Box> to add components, or start with a template
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pointerEvents: "auto" }}>
                {allTemplates.map((tpl) => (
                  <Button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl.id)}
                    variant="outlined"
                    sx={{
                      textTransform: "none", justifyContent: "flex-start", gap: 1.5, px: 2, py: 1,
                      borderColor: "#3f3f46", color: "#d4d4d8", fontSize: "0.75rem", fontWeight: 500,
                      "&:hover": { borderColor: "#22c55e", bgcolor: "rgba(34,197,94,0.08)", color: "#22c55e" },
                    }}
                  >
                    <Box component="span" sx={{ fontSize: "16px", lineHeight: 1, display: "inline-flex" }}><tpl.icon size={16} /></Box>
                    <Box sx={{ textAlign: "left" }}>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "inherit" }}>{tpl.label}</Typography>
                      <Typography sx={{ fontSize: "0.6rem", color: "#71717a", mt: 0.25 }}>{tpl.desc}</Typography>
                    </Box>
                  </Button>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Floating HUD — overlays canvas */}
      <TopToolbar
        projectId={projectId}
        onStart={simStart}
        onStop={simStop}
        showMaturityPanel={showMaturityPanel}
        onToggleMaturityPanel={onToggleMaturityPanel}
        showInsightsPanel={showInsightsPanel}
        onToggleInsightsPanel={onToggleInsightsPanel}
        showFinOpsModal={activePanel === "finops"}
        onToggleFinOpsModal={() => setActivePanel((prev) => prev === "finops" ? null : "finops")}
      />

      {activeChallenge && (
        <ChallengeTimerBar
          challenge={activeChallenge}
          onSubmit={() => submitChallenge(activeChallenge.id, activeChallenge.projectId)}
          submitting={submitting}
        />
      )}

      {wsStatus === "disconnected" && useSimulationStore.getState().isRunning && (
        <Box sx={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: spatialTokens.z.floatingPanels, pointerEvents: "none", display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1, className: "floating-island", bgcolor: "rgba(249,115,22,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "8px" }}>
          <Box component="span" sx={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } }, animation: "spin 1s linear infinite", height: 10, width: 10, border: "1.5px solid", borderColor: "#fb923c", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
          <Typography sx={{ fontSize: "10px", fontWeight: 500, color: "#fb923c", fontFamily: spatialTokens.font.ui }}>Connection lost. Reconnecting...</Typography>
        </Box>
      )}
      {wsStatus === "error" && !useSimulationStore.getState().isRunning && (
        <Box sx={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: spatialTokens.z.floatingPanels, pointerEvents: "none", display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1, className: "floating-island", bgcolor: "rgba(239,68,68,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>
          <Typography sx={{ fontSize: "10px", fontWeight: 500, color: spatialTokens.accent.error, fontFamily: spatialTokens.font.ui }}>WebSocket connection failed</Typography>
        </Box>
      )}

      {scoreReport && (
        <ScoreReportModal report={scoreReport} onClose={clearActiveChallenge} />
      )}

      {/* Floating StatusBar — bottom-right */}
      <StatusBar
        saving={saving}
        collabConnected={collabConnected}
        remoteUsers={remoteUsers}
      />

      {/* Radial context menu */}
      <RadialMenu
        nodeId={contextMenu?.nodeId ?? null}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={closeContextMenu}
      />

      {/* Floating node inspector */}
      <FloatingInspector />

      {/* Component spawner */}
      <ComponentSpawner reactFlowInstance={reactFlowInstance} />

      {/* Deep-dive chart overlay */}
      <DeepDiveChart
        nodeId={deepDiveNodeId}
        onClose={() => setDeepDiveNodeId(null)}
      />

      {/* Overlays */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
        onExecute={handlePaletteExecute}
      />
      <ToastContainer />
      <ActionDock activePanel={activePanel} onPanelChange={setActivePanel} />

      <FloatingFeaturePanel
        open={activePanel === "chaos"}
        onClose={() => { setActivePanel(null); useChaosStore.getState().setShowChaosPanel(false); }}
        title="Chaos Engineering"
        color="#F59E0B"
      >
        <ChaosPanel />
      </FloatingFeaturePanel>

      <FloatingFeaturePanel
        open={activePanel === "deploy"}
        onClose={() => { setActivePanel(null); useDeployStore.getState().setShowDeployPanel(false); }}
        title="Deployment"
        color="#8B5CF6"
      >
        <DeploymentPanel />
      </FloatingFeaturePanel>

      <FloatingFeaturePanel
        open={activePanel === "security"}
        onClose={() => setActivePanel(null)}
        title="Security Analysis"
        color="#3B82F6"
      >
        <SecurityPanel />
      </FloatingFeaturePanel>

      <FloatingFeaturePanel
        open={activePanel === "finops"}
        onClose={() => setActivePanel(null)}
        title="Cost Estimation"
        color="#22C55E"
      >
        <FinOpsModal onClose={() => setActivePanel(null)} embedded />
      </FloatingFeaturePanel>

      <FloatingFeaturePanel
        open={activePanel === "export"}
        onClose={() => setActivePanel(null)}
        title="Export Infrastructure as Code"
        color="#A855F7"
      >
        <ExportModal embedded />
      </FloatingFeaturePanel>

      <MaturityModal
        projectId={projectId}
        open={showMaturityPanel}
        onClose={() => setShowMaturityPanel(false)}
        projectName={currentProject?.name}
        reactFlowRef={reactFlowWrapper}
        simulationRunId={useSimulationStore.getState().runId ?? undefined}
      />
      <ArchitectureInsightsPanel
        open={showInsightsPanel}
        onClose={() => setShowInsightsPanel(false)}
      />

      {/* Chaos flash overlay */}
      {chaosFlash && (
        <Box sx={{ position: "fixed", inset: 0, zIndex: spatialTokens.z.toasts, pointerEvents: "none", bgcolor: "rgba(239,68,68,0.05)", transition: "opacity 0.15s" }} />
      )}

      {/* Quake terminal */}
      <QuakeTerminal open={terminalOpen} onClose={() => setTerminalOpen(false)} />
    </Box>
  );
});

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ReactFlowProvider>
      <ProjectCanvas id={id!} />
    </ReactFlowProvider>
  );
}
