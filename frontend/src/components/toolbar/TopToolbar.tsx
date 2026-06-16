import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Play, Square, MoreHorizontal, Camera, FileText, Globe, ShieldCheck, Lightbulb, DollarSign, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useExportStore } from "../../store/exportStore";
import { useSimulationStore } from "../../store/simulationStore";
import { spatialTokens } from "../../theme/spatialTokens";
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
        zIndex: spatialTokens.z.topToolbar,
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        pointerEvents: "auto",
        userSelect: "none",
        minWidth: 520,
        maxWidth: "calc(100vw - 48px)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: "0 1 auto" }}>
        <Tooltip title="Back to Dashboard" arrow>
          <IconButton size="small" onClick={() => navigate("/dashboard")} sx={{ color: spatialTokens.text.secondary, p: 0.5, "&:hover": { color: spatialTokens.text.primary } }}>
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
              color: spatialTokens.text.primary, fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.3,
              bgcolor: "rgba(255,255,255,0.06)", borderRadius: "4px", px: 0.75, py: 0.15,
              "& .MuiInputBase-input": { p: 0 },
              width: 160,
              fontFamily: spatialTokens.font.ui,
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
                fontSize: "0.75rem", fontWeight: 600, color: spatialTokens.text.primary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 160, lineHeight: 1.3, fontFamily: spatialTokens.font.ui,
              }}
            >
              {currentProject?.name || "Project"}
            </Typography>
            {currentProject?.role && (
              <Typography
                sx={{
                  fontSize: "0.5rem", color: spatialTokens.text.dim,
                  bgcolor: "rgba(255,255,255,0.05)", px: 0.5, py: 0.15, borderRadius: "3px",
                  fontWeight: 500, fontFamily: spatialTokens.font.ui, lineHeight: 1.3,
                }}
              >
                {currentProject.role}
              </Typography>
            )}
          </Box>
        )}
      </Box>

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
              color: isSimRunning ? spatialTokens.accent.error : spatialTokens.accent.success, p: 0.35,
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
            fontFamily: spatialTokens.font.mono,
            color: spatialTokens.text.secondary,
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
                color: simSpeed === s ? spatialTokens.accent.primary : spatialTokens.text.dim,
                bgcolor: simSpeed === s ? "rgba(99,102,241,0.15)" : "transparent",
                lineHeight: 1.5,
                fontFamily: spatialTokens.font.ui,
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
            <Typography sx={{ fontSize: "0.55rem", color: spatialTokens.text.dim, fontFamily: spatialTokens.font.ui, fontWeight: 500 }}>
              RPS
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: spatialTokens.metrics.rps, fontFamily: spatialTokens.font.mono, fontVariantNumeric: "tabular-nums" }}>
              {totalRPS.toLocaleString()}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.5rem", color: spatialTokens.text.dim }}>|</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography sx={{ fontSize: "0.55rem", color: spatialTokens.text.dim, fontFamily: spatialTokens.font.ui, fontWeight: 500 }}>
              ERR
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: errorPercent > 5 ? spatialTokens.accent.error : spatialTokens.accent.warning, fontFamily: spatialTokens.font.mono, fontVariantNumeric: "tabular-nums" }}>
              {errorPercent.toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        <Tooltip title="More actions" arrow>
          <IconButton
            size="small"
            onClick={(e) => setOverflowAnchorEl(e.currentTarget)}
            sx={{ color: spatialTokens.text.secondary, p: 0.4, "&:hover": { color: spatialTokens.text.primary } }}
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
                border: spatialTokens.border.island, borderRadius: "8px",
                boxShadow: spatialTokens.shadow.elevation,
              },
            },
          }}
        >
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleMaturityPanel(); }} dense>
            <ShieldCheck size={13} style={{ marginRight: 8, color: showMaturityPanel ? spatialTokens.accent.success : spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: showMaturityPanel ? spatialTokens.accent.success : spatialTokens.text.secondary }}>Maturity</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleInsightsPanel(); }} dense>
            <Lightbulb size={13} style={{ marginRight: 8, color: showInsightsPanel ? spatialTokens.accent.warning : spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: showInsightsPanel ? spatialTokens.accent.warning : spatialTokens.text.secondary }}>Insights</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); onToggleFinOpsModal(); }} dense>
            <DollarSign size={13} style={{ marginRight: 8, color: showFinOpsModal ? spatialTokens.accent.success : spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: showFinOpsModal ? spatialTokens.accent.success : spatialTokens.text.secondary }}>Cost</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
          <MenuItem onClick={() => { setOverflowAnchorEl(null); setShowGlobalMap(true); }} dense>
            <Globe size={13} style={{ marginRight: 8, color: spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: spatialTokens.text.secondary }}>Global Map</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); setShowImport(true); }} dense>
            <FileText size={13} style={{ marginRight: 8, color: spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: spatialTokens.text.secondary }}>Import IaC</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
          <MenuItem onClick={() => { setOverflowAnchorEl(null); openExport(); }} dense>
            <Download size={13} style={{ marginRight: 8, color: spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: spatialTokens.text.secondary }}>Export</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setOverflowAnchorEl(null); openExport(); }} dense>
            <Camera size={13} style={{ marginRight: 8, color: spatialTokens.text.secondary }} />
            <Typography sx={{ fontSize: "0.7rem", color: spatialTokens.text.secondary }}>PNG Snapshot</Typography>
          </MenuItem>
        </Menu>
      </Box>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <GlobalMapDialog open={showGlobalMap} onClose={() => setShowGlobalMap(false)} runId={runId} />
    </Box>
  );
}
