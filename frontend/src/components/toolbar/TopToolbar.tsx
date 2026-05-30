import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Play, Square, Share2, Shield, DollarSign, Download, Camera, FileText, Building2, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useAuthStore } from "../../store/authStore";
import { useExportStore } from "../../store/exportStore";
import ImportModal from "../panels/ImportModal";
import {
  AppBar, Toolbar, IconButton, Tooltip, Menu, MenuItem, Typography, Box, Divider,
  ToggleButtonGroup, ToggleButton, Avatar, AvatarGroup, InputBase, Paper,
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
  showFinOpsPanel: boolean;
  onToggleFinOpsPanel: () => void;
  showDrillPanel: boolean;
  onToggleDrillPanel: () => void;
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

export default function TopToolbar({ projectId, saving, onStart, onStop, collabConnected, remoteUsers }: TopToolbarProps) {
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

  /* ---- export dropdown (MUI Menu) ---- */
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);

  /* ---- user dropdown (MUI Menu) ---- */
  const [userAnchorEl, setUserAnchorEl] = useState<HTMLElement | null>(null);

  const saveLabel = saving ? "Saving" : isDirty ? "Unsaved" : lastSaved ? "Saved" : "";

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}>
      <Toolbar variant="dense" sx={{ minHeight: 48, px: 2, gap: 0, display: "flex", alignItems: "center" }}>
        {/* ═══ Zone 1: Navigation & Context (flex:1) ═══ */}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Tooltip title="Back to Dashboard" arrow>
            <IconButton size="small" onClick={() => navigate("/dashboard")} sx={{ color: "#a1a1aa" }}>
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
                color: "#f4f4f5", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.2,
                bgcolor: "background.elevated", borderRadius: "4px", px: 1, py: 0.25,
                "& .MuiInputBase-input": { p: 0 },
                width: 200,
              }}
            />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, cursor: "pointer" }} onClick={startEditing} title="Click to rename">
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#f4f4f5", fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, lineHeight: 1.2 }}>
                {currentProject?.name || "Project"}
              </Typography>
              {currentProject?.role && (
                <Typography variant="caption" sx={{ color: "#71717a", bgcolor: "background.paper", px: 0.75, py: 0.25, borderRadius: "4px", fontSize: "0.6rem", fontWeight: 500, flexShrink: 0 }}>
                  {currentProject.role}
                </Typography>
              )}
            </Box>
          )}

          {/* Auto-save status */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
            <SaveDot saving={saving} isDirty={isDirty} />
            <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>
              {saveLabel}
            </Typography>
          </Box>
        </Box>

        {/* ═══ Zone 2: Simulation Status & Controls (flex:0) ═══ */}
        <Box sx={{ flex: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Paper sx={{ px: 1.5, py: 0.5, borderRadius: "20px", display: "flex", alignItems: "center", gap: 1, bgcolor: "background.elevated" }}>
            <Tooltip title={isSimRunning ? "Stop Simulation" : "Start Simulation"} arrow>
              <IconButton
                size="small"
                onClick={() => (isSimRunning ? onStop() : onStart())}
                sx={{
                  color: isSimRunning ? "#ef4444" : "#22c55e", p: 0.5,
                  bgcolor: isSimRunning ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                  "&:hover": { bgcolor: isSimRunning ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)" },
                }}
              >
                {isSimRunning ? <Square size={14} /> : <Play size={14} />}
              </IconButton>
            </Tooltip>

            <ToggleButtonGroup
              size="small"
              value={simSpeed}
              exclusive
              onChange={(_, v) => v !== null && setSimSpeed(v)}
              sx={{
                "& .MuiToggleButton-root": {
                  border: "none", borderRadius: "6px !important", px: 1, py: 0.25,
                  fontSize: "0.6rem", fontWeight: 600, color: "#71717a", lineHeight: 1.5,
                  bgcolor: "transparent",
                  "&.Mui-selected": {
                    bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e",
                    "&:hover": { bgcolor: "rgba(34,197,94,0.2)" },
                  },
                  "&:hover": { bgcolor: "#3f3f46" },
                },
              }}
            >
              <ToggleButton value={1}>1×</ToggleButton>
              <ToggleButton value={2}>2×</ToggleButton>
              <ToggleButton value={5}>5×</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="caption" sx={{ fontFamily: '"ui-monospace","SFMono-Regular",monospace', color: "#a1a1aa", fontSize: "0.7rem", minWidth: 56, textAlign: "center" }}>
              {formatTime(elapsed)}
            </Typography>
          </Paper>
        </Box>

        {/* ═══ Zone 3: Global Actions & User (flex:1) ═══ */}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
          <Tooltip title="Share project" arrow>
            <IconButton size="small" sx={{ color: "#a1a1aa" }}>
              <Share2 size={16} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Security Audit" arrow>
            <IconButton size="small" sx={{ color: "#60a5fa" }}>
              <Shield size={16} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Cost Estimation" arrow>
            <IconButton size="small" sx={{ color: "#22c55e" }}>
              <DollarSign size={16} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export" arrow>
            <IconButton size="small" onClick={(e) => setExportAnchorEl(e.currentTarget)} sx={{ color: "#a1a1aa" }}>
              <Download size={16} />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={() => setExportAnchorEl(null)} dense><Camera size={14} style={{ marginRight: 8 }} /> Export as PNG</MenuItem>
            <MenuItem onClick={() => setExportAnchorEl(null)} dense><FileText size={14} style={{ marginRight: 8 }} /> Export as JSON</MenuItem>
            <Divider />
            <MenuItem onClick={() => { setExportAnchorEl(null); openExport(); }} dense sx={{ color: "success.main" }}><Building2 size={14} style={{ marginRight: 8 }} /> IaC Export</MenuItem>
          </Menu>

          <Tooltip title="Import IaC" arrow>
            <IconButton size="small" onClick={() => setShowImport(true)} sx={{ color: "#a1a1aa" }}>
              <FileText size={16} />
            </IconButton>
          </Tooltip>

          {collabConnected && remoteUsers.length > 0 && (
            <AvatarGroup max={4} sx={{ "& .MuiAvatar-root": { width: 22, height: 22, fontSize: "0.5rem", fontWeight: 700, border: "2px solid #09090b", ml: -0.5 } }}>
              {remoteUsers.map((u) => (
                <Tooltip key={u.clientId} title={u.name} arrow>
                  <Avatar sx={{ bgcolor: u.color, color: "#fff" }}>{u.name.charAt(0).toUpperCase()}</Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          )}

          <Divider orientation="vertical" flexItem sx={{ borderColor: "divider", mx: 0.5 }} />

          <Tooltip title="Observability" arrow>
            <IconButton size="small" onClick={() => navigate(`/project/${projectId}/observe`)} sx={{ color: "#a1a1aa" }}>
              <BarChart3 size={16} />
            </IconButton>
          </Tooltip>

          {/* User dropdown */}
          <IconButton size="small" onClick={(e) => setUserAnchorEl(e.currentTarget)} sx={{ color: "#a1a1aa", display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
            <Box sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 600, color: "#22c55e" }}>
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </Box>
            <Typography variant="caption" sx={{ color: "#a1a1aa", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.7rem" }}>
              {user?.username ?? "User"}
            </Typography>
          </IconButton>
          <Menu anchorEl={userAnchorEl} open={Boolean(userAnchorEl)} onClose={() => setUserAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem disabled dense><Typography variant="caption" sx={{ color: "#71717a" }}>{user?.email ?? ""}</Typography></MenuItem>
            <MenuItem onClick={() => { setUserAnchorEl(null); navigate("/settings"); }} dense>Settings</MenuItem>
            <MenuItem onClick={() => { setUserAnchorEl(null); logout(); navigate("/login"); }} dense sx={{ color: "error.main" }}>Sign Out</MenuItem>
          </Menu>
        </Box>

        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      </Toolbar>
    </AppBar>
  );
}
