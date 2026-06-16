import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Play, Square, MoreHorizontal, Camera, FileText, Globe, ShieldCheck, Lightbulb, DollarSign, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useExportStore } from "../../store/exportStore";
import { useSimulationStore } from "../../store/simulationStore";
import ImportModal from "../panels/ImportModal";
import GlobalMapDialog from "../map/GlobalMap";
import {
  Box, Typography, IconButton, Tooltip, Menu, MenuItem, Divider, InputBase,
} from "@mui/material";

interface TopToolbarProps {
  projectId: string;
  onStart: () => void;
  onStop: () => void;
  showMaturityPanel: boolean;
  onToggleMaturityPanel: () => void;
  showInsightsPanel: boolean;
  onToggleInsightsPanel: () => void;
  showFinOpsModal: boolean;
  onToggleFinOpsModal: () => void;
}

export default function TopToolbar({
  projectId, onStart, onStop,
  showMaturityPanel, onToggleMaturityPanel,
  showInsightsPanel, onToggleInsightsPanel,
  showFinOpsModal, onToggleFinOpsModal,
}: TopToolbarProps) {
  const navigate = useNavigate();
  const { currentProject, updateProject } = useProjectStore(useShallow((s) => ({ currentProject: s.currentProject, updateProject: s.updateProject })));

  const isSimRunning = useCanvasStore((s) => s.isSimulationRunning);
  const simSpeed = useCanvasStore((s) => s.simulationSpeed);
  const setSimSpeed = useCanvasStore((s) => s.setSimulationSpeed);
  const nodes = useCanvasStore((s) => s.nodes);

  const openExport = useExportStore((s) => s.openExport);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setNameDraft(currentProject?.name ?? "");
    setEditingName(true);
  }, [currentProject?.name]);

  const commitName = useCallback(async () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== currentProject?.name) {
      await updateProject(projectId, { name: trimmed });
    }
  }, [nameDraft, currentProject?.name, projectId, updateProject]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isSimRunning) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSimRunning]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const [showImport, setShowImport] = useState(false);
  const [showGlobalMap, setShowGlobalMap] = useState(false);
  const runId = useSimulationStore((s) => s.runId);
  const [overflowAnchorEl, setOverflowAnchorEl] = useState<HTMLElement | null>(null);

  /* ── Global stats ── */
  const totalRPS = useMemo(() =>
    nodes.reduce((sum, n) => sum + (n.data?.metrics?.currentRPS ?? 0), 0),
  [nodes]);

  const errorPercent = useMemo(() => {
    const withTraffic = nodes.filter((n) => (n.data?.metrics?.currentRPS ?? 0) > 0);
    if (withTraffic.length === 0) return 0;
    const totalErr = withTraffic.reduce((sum, n) => sum + (n.data?.metrics?.errorRate ?? 0), 0);
    return totalErr / withTraffic.length;
  }, [nodes]);

  return (
    <Box
      className="floating-island"
      sx={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        background: "rgba(5,5,7,0.75)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        pointerEvents: "auto",
        userSelect: "none",
        minWidth: 520,
        maxWidth: "calc(100vw - 48px)",
      }}
    >
      {/* ── Left: Back + Project Name ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: "0 1 auto" }}>
        <Tooltip title="Back to Dashboard" arrow>
          <IconButton size="small" onClick={() => navigate("/dashboard")} sx={{ color: "rgba(255,255,255,0.4)", p: 0.5, "&:hover": { color: "rgba(255,255,255,0.7)" } }}>
            <ArrowLeft size={16} />
          </IconButton>
        </Tooltip>

        {editingName ? (
          <InputBase
            inputRef={nameInputRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") setEditingName(false);
            }}
            sx={{
              color: "#EDEDEF", fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.3,
              bgcolor: "rgba(255,255,255,0.06)", borderRadius: "4px", px: 0.75, py: 0.15,
              "& .MuiInputBase-input": { p: 0 },
              width: 160,
              fontFamily: '"Inter", sans-serif',
            }}
          />
        ) : (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.75, cursor: "pointer", minWidth: 0 }}
            onDoubleClick={startEditing}
            title="Double-click to rename"
          >
            <Typography
              sx={{
                fontSize: "0.75rem", fontWeight: 600, color: "#EDEDEF",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 160, lineHeight: 1.3, fontFamily: '"Inter", sans-serif',
              }}
            >
              {currentProject?.name || "Project"}
            </Typography>
            {currentProject?.role && (
              <Typography
                sx={{
                  fontSize: "0.5rem", color: "rgba(255,255,255,0.3)",
                  bgcolor: "rgba(255,255,255,0.05)", px: 0.5, py: 0.15, borderRadius: "3px",
                  fontWeight: 500, fontFamily: '"Inter", sans-serif', lineHeight: 1.3,
                }}
              >
                {currentProject.role}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* ── Center: Transport Pill ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          bgcolor: "rgba(255,255,255,0.05)",
          borderRadius: "9999px",
          px: 1,
          py: 0.35,
          mx: "auto",
          flexShrink: 0,
        }}
      >
        <Tooltip title={isSimRunning ? "Stop Simulation" : "Start Simulation"} arrow>
          <IconButton
            size="small"
            onClick={() => (isSimRunning ? onStop() : onStart())}
            sx={{
              color: isSimRunning ? "#EF4444" : "#22C55E", p: 0.35,
              bgcolor: isSimRunning ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
              "&:hover": { bgcolor: isSimRunning ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)" },
              width: 22, height: 22,
            }}
          >
            {isSimRunning ? <Square size={12} /> : <Play size={12} />}
          </IconButton>
        </Tooltip>

        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "rgba(255,255,255,0.5)",
            fontSize: "0.65rem",
            minWidth: 52,
            textAlign: "center",
            lineHeight: 1.5,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(elapsed)}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.15, ml: 0.25 }}>
          {[1, 2, 5].map((s) => (
            <Box
              key={s}
              onClick={() => setSimSpeed(s)}
              sx={{
                cursor: "pointer",
                px: 0.4, py: 0.1,
                borderRadius: "4px",
                fontSize: "0.55rem",
                fontWeight: 600,
                color: simSpeed === s ? "#6366F1" : "rgba(255,255,255,0.3)",
                bgcolor: simSpeed === s ? "rgba(99,102,241,0.15)" : "transparent",
                lineHeight: 1.5,
                fontFamily: '"Inter", sans-serif',
                "&:hover": {
                  bgcolor: simSpeed === s ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.04)",
                },
              }}
            >
              {s}×
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Right: Stats + Overflow ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "0 1 auto", ml: "auto" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.35,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: "6px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", fontFamily: '"Inter", sans-serif', fontWeight: 500 }}>
              RPS
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#34D399", fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: "tabular-nums" }}>
              {totalRPS.toLocaleString()}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.15)", fontFamily: '"Inter", sans-serif' }}>|</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", fontFamily: '"Inter", sans-serif', fontWeight: 500 }}>
              ERR
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: errorPercent > 5 ? "#EF4444" : "#F59E0B", fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: "tabular-nums" }}>
              {errorPercent.toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        {/* Overflow menu */}
        <Tooltip title="More actions" arrow>
          <IconButton
            size="small"
            onClick={(e) => setOverflowAnchorEl(e.currentTarget)}
            sx={{ color: "rgba(255,255,255,0.3)", p: 0.4, "&:hover": { color: "rgba(255,255,255,0.6)" } }}
          >
            <MoreHorizontal size={14} />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={overflowAnchorEl}
          open={Boolean(overflowAnchorEl)}
          onClose={() => setOverflowAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: "rgba(20,20,24,0.92)", backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              },
            },
          }}
        >
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleMaturityPanel(); }} dense>
            <ShieldCheck size={13} style={{ marginRight: 8, color: showMaturityPanel ? "#22C55E" : "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: showMaturityPanel ? "#22C55E" : "rgba(255,255,255,0.7)" }}>Maturity</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleInsightsPanel(); }} dense>
            <Lightbulb size={13} style={{ marginRight: 8, color: showInsightsPanel ? "#F59E0B" : "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: showInsightsPanel ? "#F59E0B" : "rgba(255,255,255,0.7)" }}>Insights</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleFinOpsModal(); }} dense>
            <DollarSign size={13} style={{ marginRight: 8, color: showFinOpsModal ? "#22C55E" : "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: showFinOpsModal ? "#22C55E" : "rgba(255,255,255,0.7)" }}>Cost</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
          <MenuItem onClick={() => { setOverflowAnchorEl(null); setShowGlobalMap(true); }} dense>
            <Globe size={13} style={{ marginRight: 8, color: "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)" }}>Global Map</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); setShowImport(true); }} dense>
            <FileText size={13} style={{ marginRight: 8, color: "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)" }}>Import IaC</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
          <MenuItem onClick={() => { setOverflowAnchorEl(null); openExport(); }} dense>
            <Download size={13} style={{ marginRight: 8, color: "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)" }}>Export</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); openExport(); }} dense>
            <Camera size={13} style={{ marginRight: 8, color: "rgba(255,255,255,0.4)" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)" }}>PNG Snapshot</Typography>
          </MenuItem>
        </Menu>
      </Box>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <GlobalMapDialog open={showGlobalMap} onClose={() => setShowGlobalMap(false)} runId={runId} />
    </Box>
  );
}
