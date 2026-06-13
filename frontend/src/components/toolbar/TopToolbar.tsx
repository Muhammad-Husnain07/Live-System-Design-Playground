import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Play, Square, Share2, ShieldCheck, Lightbulb, DollarSign, Download, Camera, FileText, Building2, Globe, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useAuthStore } from "../../store/authStore";
import { useExportStore } from "../../store/exportStore";
import { useSimulationStore } from "../../store/simulationStore";
import ImportModal from "../panels/ImportModal";
import GlobalMapDialog from "../map/GlobalMap";
import {
  Box, Typography, IconButton, Tooltip, Menu, MenuItem, Divider,
  Avatar, AvatarGroup, InputBase,
} from "@mui/material";

interface TopToolbarProps {
  projectId: string;
  saving: boolean;
  onStart: () => void;
  onStop: () => void;
  showSimPanel: boolean;
  onToggleSimPanel: () => void;
  showChaosPanel: boolean;
  onToggleChaosPanel: () => void;
  showDeployPanel: boolean;
  onToggleDeployPanel: () => void;
  showSecurityPanel: boolean;
  onToggleSecurityPanel: () => void;
  showFinOpsModal: boolean;
  onToggleFinOpsModal: () => void;
  showDrillPanel: boolean;
  onToggleDrillPanel: () => void;
  showMaturityPanel: boolean;
  onToggleMaturityPanel: () => void;
  showInsightsPanel: boolean;
  onToggleInsightsPanel: () => void;
  collabConnected: boolean;
  remoteUsers: { clientId: number; name: string; color: string }[];
}

const pulseKeyframes = {
  "@keyframes pulse-dot": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.3 },
  },
};

function SaveDot({ saving, isDirty }: { saving: boolean; isDirty: boolean }) {
  const color = saving ? "#eab308" : isDirty ? "#fb923c" : "#22c55e";
  return (
    <Box
      sx={{
        width: 6, height: 6, borderRadius: "50%", bgcolor: color, flexShrink: 0,
        animation: saving || isDirty ? "pulse-dot 1.2s ease-in-out infinite" : "none",
        ...pulseKeyframes,
      }}
    />
  );
}

export default function TopToolbar({
  projectId, saving, onStart, onStop,
  showMaturityPanel, onToggleMaturityPanel,
  showInsightsPanel, onToggleInsightsPanel,
  showFinOpsModal, onToggleFinOpsModal,
  collabConnected, remoteUsers,
}: TopToolbarProps) {
  const navigate = useNavigate();
  const { currentProject, updateProject } = useProjectStore(useShallow((s) => ({ currentProject: s.currentProject, updateProject: s.updateProject })));
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));

  const isDirty = useCanvasStore((s) => s.isDirty);
  const lastSaved = useCanvasStore((s) => s.lastSaved);
  const isSimRunning = useCanvasStore((s) => s.isSimulationRunning);
  const simSpeed = useCanvasStore((s) => s.simulationSpeed);
  const setSimSpeed = useCanvasStore((s) => s.setSimulationSpeed);

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

  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);
  const [userAnchorEl, setUserAnchorEl] = useState<HTMLElement | null>(null);

  const saveLabel = saving ? "Saving" : isDirty ? "Unsaved" : lastSaved ? "Saved" : "";

  return (
    <Box
      sx={{
        height: 44,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        px: 2,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* ──── Left: Back, Project Name, Save Status ──── */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <Tooltip title="Back to Dashboard" arrow>
          <IconButton size="small" onClick={() => navigate("/dashboard")} sx={{ color: "text.secondary" }}>
            <ArrowLeft size={18} />
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
              color: "text.primary", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.2,
              bgcolor: "background.elevated", borderRadius: "4px", px: 1, py: 0.25,
              "& .MuiInputBase-input": { p: 0 },
              width: 200,
            }}
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, cursor: "pointer" }} onClick={startEditing} title="Click to rename">
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, lineHeight: 1.2 }}>
              {currentProject?.name || "Project"}
            </Typography>
            {currentProject?.role && (
              <Typography variant="caption" sx={{ color: "text.secondary", bgcolor: "background.elevated", px: 0.75, py: 0.25, borderRadius: "4px", fontSize: "0.6rem", fontWeight: 500, flexShrink: 0 }}>
                {currentProject.role}
              </Typography>
            )}
          </Box>
        )}

        {/* Auto-save status */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          <SaveDot saving={saving} isDirty={isDirty} />
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>
            {saveLabel}
          </Typography>
        </Box>
      </Box>

      {/* ──── Center: Simulation Controls (pill) ──── */}
      <Box sx={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        <Box
          sx={{
            bgcolor: "background.elevated",
            borderRadius: "9999px",
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.5,
            py: 0.4,
          }}
        >
          {/* Play / Stop */}
          <Tooltip title={isSimRunning ? "Stop Simulation" : "Start Simulation"} arrow>
            <IconButton
              size="small"
              onClick={() => (isSimRunning ? onStop() : onStart())}
              sx={{
                color: isSimRunning ? "error.main" : "success.main", p: 0.5,
                bgcolor: isSimRunning ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                "&:hover": { bgcolor: isSimRunning ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)" },
                width: 22, height: 22,
              }}
            >
              {isSimRunning ? <Square size={12} /> : <Play size={12} />}
            </IconButton>
          </Tooltip>

          {/* Timer */}
          <Typography
            variant="caption"
            sx={{
              fontFamily: '"JetBrains Mono", "SFMono-Regular", monospace',
              color: "text.secondary",
              fontSize: "0.7rem",
              minWidth: 56,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {formatTime(elapsed)}
          </Typography>

          {/* Speed toggle */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            {[1, 2, 5].map((s) => (
              <Box
                key={s}
                onClick={() => setSimSpeed(s)}
                sx={{
                  cursor: "pointer",
                  px: 0.5,
                  py: 0.15,
                  borderRadius: "4px",
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  color: simSpeed === s ? "primary.main" : "text.secondary",
                  bgcolor: simSpeed === s ? "rgba(99,102,241,0.12)" : "transparent",
                  lineHeight: 1.5,
                  "&:hover": {
                    bgcolor: simSpeed === s ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                  },
                }}
              >
                {s}×
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ──── Right: Icon Actions + User ──── */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
        <Tooltip title="Share project" arrow>
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <Share2 size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Maturity Assessment" arrow>
          <IconButton size="small" onClick={onToggleMaturityPanel} sx={{ color: showMaturityPanel ? "success.main" : "text.secondary" }}>
            <ShieldCheck size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Architecture Insights" arrow>
          <IconButton size="small" onClick={onToggleInsightsPanel} sx={{ color: showInsightsPanel ? "warning.main" : "text.secondary" }}>
            <Lightbulb size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Cost Estimation" arrow>
          <IconButton size="small" onClick={onToggleFinOpsModal} sx={{ color: showFinOpsModal ? "#22c55e" : "#8B8B8F" }}>
            <DollarSign size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export" arrow>
          <IconButton size="small" onClick={(e) => setExportAnchorEl(e.currentTarget)} sx={{ color: "text.secondary" }}>
            <Download size={16} />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
          <MenuItem onClick={() => setExportAnchorEl(null)} dense><Camera size={14} style={{ marginRight: 8 }} /> Export as PNG</MenuItem>
          <MenuItem onClick={() => setExportAnchorEl(null)} dense><FileText size={14} style={{ marginRight: 8 }} /> Export as JSON</MenuItem>
          <Divider />
          <MenuItem onClick={() => { setExportAnchorEl(null); openExport(); }} dense sx={{ color: "success.main" }}><Building2 size={14} style={{ marginRight: 8 }} /> IaC Export</MenuItem>
        </Menu>

        <Tooltip title="Global Map" arrow>
          <IconButton size="small" onClick={() => setShowGlobalMap(true)} sx={{ color: "success.main" }}>
            <Globe size={16} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Import IaC" arrow>
          <IconButton size="small" onClick={() => setShowImport(true)} sx={{ color: "text.secondary" }}>
            <FileText size={16} />
          </IconButton>
        </Tooltip>

        {collabConnected && remoteUsers.length > 0 && (
          <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 22, height: 22, fontSize: "0.5rem", fontWeight: 700, border: "2px solid", borderColor: "background.default", ml: -0.5 } }}>
            {remoteUsers.map((u) => (
              <Tooltip key={u.clientId} title={u.name} arrow>
                <Avatar sx={{ bgcolor: u.color, color: "#fff" }}>{u.name.charAt(0).toUpperCase()}</Avatar>
              </Tooltip>
            ))}
          </AvatarGroup>
        )}

        <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

        <Tooltip title="Observability" arrow>
          <IconButton size="small" onClick={() => navigate(`/project/${projectId}/observe`)} sx={{ color: "text.secondary" }}>
            <BarChart3 size={16} />
          </IconButton>
        </Tooltip>

        {/* User dropdown */}
        <IconButton size="small" onClick={(e) => setUserAnchorEl(e.currentTarget)} sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 600, color: "success.main" }}>
            {user?.username?.charAt(0).toUpperCase() ?? "?"}
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.7rem" }}>
            {user?.username ?? "User"}
          </Typography>
        </IconButton>
        <Menu anchorEl={userAnchorEl} open={Boolean(userAnchorEl)} onClose={() => setUserAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
          <MenuItem disabled dense><Typography variant="caption" sx={{ color: "text.secondary" }}>{user?.email ?? ""}</Typography></MenuItem>
          <MenuItem onClick={() => { setUserAnchorEl(null); navigate("/settings"); }} dense>Settings</MenuItem>
          <MenuItem onClick={() => { setUserAnchorEl(null); logout(); navigate("/login"); }} dense sx={{ color: "error.main" }}>Sign Out</MenuItem>
        </Menu>
      </Box>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <GlobalMapDialog open={showGlobalMap} onClose={() => setShowGlobalMap(false)} runId={runId} />
    </Box>
  );
}
