import { useState, useRef, useEffect, useCallback } from "react";
import { Undo2, Redo2, Square, Play, Users, ChevronDown, Camera, FileText, Building2, Skull, Rocket, Shield, Zap, BarChart3, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useAuthStore } from "../../store/authStore";
import { useExportStore } from "../../store/exportStore";
import ImportModal from "../panels/ImportModal";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";

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

function PanelBtn({ active, color, onClick, icon, label }: { active: boolean; color: string; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Tooltip title={label} arrow>
      <IconButton onClick={onClick} size="small" sx={{ color: active ? color : "#a1a1aa", bgcolor: active ? `${color}33` : "action.hover", "&:hover": { bgcolor: active ? `${color}44` : "action.selected" }, borderRadius: 1 }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export default function TopToolbar({ projectId, saving, onStart, onStop, showSimPanel, onToggleSimPanel, showChaosPanel, onToggleChaosPanel, showDeployPanel, onToggleDeployPanel, showSecurityPanel, onToggleSecurityPanel, showFinOpsPanel, onToggleFinOpsPanel, showDrillPanel, onToggleDrillPanel, collabConnected, remoteUsers }: TopToolbarProps) {
  const navigate = useNavigate();
  const { currentProject, updateProject } = useProjectStore();
  const { user, logout } = useAuthStore();

  const isDirty = useCanvasStore((s) => s.isDirty);
  const lastSaved = useCanvasStore((s) => s.lastSaved);
  const pastStates = useCanvasStore((s) => s.pastStates);
  const futureStates = useCanvasStore((s) => s.futureStates);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
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
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const [showImport, setShowImport] = useState(false);

  /* ---- export dropdown (MUI Menu) ---- */
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);

  /* ---- user dropdown (MUI Menu) ---- */
  const [userAnchorEl, setUserAnchorEl] = useState<HTMLElement | null>(null);

  const saveLabel = saving ? "Saving..." : isDirty ? "Unsaved changes" : lastSaved ? "Saved" : "";
  const saveColor = saving ? "#eab308" : isDirty ? "#fb923c" : "#22c55e";

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: "#09090b", borderBottom: 1, borderColor: "#27272a" }}>
      <Toolbar variant="dense" sx={{ minHeight: 52, px: 2, gap: 1 }}>
        {/* ── Left section ── */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Tooltip title="Back to Dashboard" arrow>
            <IconButton size="small" onClick={() => navigate("/dashboard")} sx={{ color: "#a1a1aa" }}>
              <Undo2 size={16} />
            </IconButton>
          </Tooltip>

          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setEditingName(false);
              }}
              style={{
                background: "#27272a", color: "#f4f4f5", border: "1px solid #52525b",
                borderRadius: 4, padding: "2px 6px", fontSize: "0.875rem", fontWeight: 500,
                width: 192, outline: "none",
              }}
            />
          ) : (
            <Typography
              variant="body2"
              onClick={startEditing}
              sx={{ fontWeight: 500, color: "text.primary", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, fontSize: "0.875rem" }}
              title="Click to rename"
            >
              {currentProject?.name || "Project"}
            </Typography>
          )}

          {currentProject?.role && (
            <Typography variant="caption" sx={{ color: "text.disabled", bgcolor: "action.hover", px: 0.75, py: 0.25, borderRadius: "4px", fontSize: "0.65rem" }}>
              {currentProject.role}
            </Typography>
          )}

          <Typography variant="caption" sx={{ color: saveColor, fontSize: "0.65rem", flexShrink: 0 }}>
            {saveLabel}
          </Typography>
        </Box>

        {/* ── Center section ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, gap: 0.5 }}>
          <Tooltip title="Undo (Ctrl+Z)" arrow>
            <span><IconButton size="small" onClick={undo} disabled={pastStates.length === 0} sx={{ color: "text.secondary" }}><Undo2 size={16} /></IconButton></span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)" arrow>
            <span><IconButton size="small" onClick={redo} disabled={futureStates.length === 0} sx={{ color: "text.secondary" }}><Redo2 size={16} /></IconButton></span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ borderColor: "#3f3f46", mx: 0.5 }} />

          <Tooltip title={isSimRunning ? "Stop Simulation" : "Start Simulation"} arrow>
            <IconButton
              size="small"
              onClick={() => (isSimRunning ? onStop() : onStart())}
              sx={{ color: isSimRunning ? "#ef4444" : "#22c55e", bgcolor: isSimRunning ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", "&:hover": { bgcolor: isSimRunning ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)" }, borderRadius: 1 }}
            >
              {isSimRunning ? <Square size={16} /> : <Play size={16} />}
            </IconButton>
          </Tooltip>

          <Box
            component="select"
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            sx={{
              bgcolor: "action.hover", color: "text.primary", fontSize: "0.65rem",
              px: 0.75, py: 0.5, borderRadius: "4px", border: 1, borderColor: "#3f3f46",
              outline: "none", cursor: "pointer",
            }}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </Box>

          {isSimRunning && (
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: "0.7rem" }}>
              {formatTime(elapsed)}
            </Typography>
          )}
        </Box>

        {/* ── Right section ── */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Manage collaborators" arrow>
            <IconButton size="small" sx={{ color: "#a1a1aa" }}><Users size={16} /></IconButton>
          </Tooltip>

          <Tooltip title="Share project" arrow>
            <IconButton size="small" sx={{ color: "#a1a1aa" }}>S</IconButton>
          </Tooltip>

          <Tooltip title="Import IaC file" arrow>
            <IconButton size="small" onClick={() => setShowImport(true)} sx={{ color: "#a1a1aa" }}>
              Imp
            </IconButton>
          </Tooltip>

          {/* Export dropdown */}
          <Tooltip title="Export" arrow>
            <IconButton size="small" onClick={(e) => setExportAnchorEl(e.currentTarget)} sx={{ color: "#a1a1aa" }}>
              Export <ChevronDown size={14} />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={() => setExportAnchorEl(null)} dense><Camera size={14} style={{ marginRight: 8 }} /> Export as PNG</MenuItem>
            <MenuItem onClick={() => setExportAnchorEl(null)} dense><FileText size={14} style={{ marginRight: 8 }} /> Export as JSON</MenuItem>
            <Divider />
            <MenuItem onClick={() => { setExportAnchorEl(null); openExport(); }} dense sx={{ color: "success.main" }}><Building2 size={14} style={{ marginRight: 8 }} /> IaC Export</MenuItem>
          </Menu>

          <PanelBtn active={showSimPanel} color="#22c55e" onClick={onToggleSimPanel} icon={<Zap size={14} />} label="Simulation Panel" />
          <PanelBtn active={showChaosPanel} color="#ef4444" onClick={onToggleChaosPanel} icon={<Skull size={14} />} label="Chaos Engineering Panel" />
          <PanelBtn active={showDeployPanel} color="#c084fc" onClick={onToggleDeployPanel} icon={<Rocket size={14} />} label="Deployment Panel" />
          <PanelBtn active={showSecurityPanel} color="#60a5fa" onClick={onToggleSecurityPanel} icon={<Shield size={14} />} label="Security Audit Panel" />
          <PanelBtn active={showDrillPanel} color="#fb923c" onClick={onToggleDrillPanel} icon={<Zap size={14} />} label="DR Drill Panel" />
          <PanelBtn active={showFinOpsPanel} color="#22c55e" onClick={onToggleFinOpsPanel} icon={<DollarSign size={14} />} label="Cost Estimation" />

          {collabConnected && remoteUsers.length > 0 && (
            <Box sx={{ display: "flex", ml: 0.5 }}>
              {remoteUsers.map((u) => (
                <Tooltip key={u.clientId} title={u.name} arrow>
                  <Box sx={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 700, border: 2, borderColor: "#09090b", bgcolor: u.color, color: "#fff", ml: -0.75 }}>
                    {u.name.charAt(0).toUpperCase()}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          )}

          <Divider orientation="vertical" flexItem sx={{ borderColor: "#3f3f46", mx: 0.25 }} />

          <Tooltip title="Observability" arrow>
            <IconButton size="small" onClick={() => navigate(`/project/${projectId}/observe`)} sx={{ color: "#a1a1aa" }}>
              <BarChart3 size={16} />
            </IconButton>
          </Tooltip>

          {/* User dropdown */}
          <IconButton size="small" onClick={(e) => setUserAnchorEl(e.currentTarget)} sx={{ color: "#a1a1aa", display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 500, color: "#22c55e" }}>
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </Box>
            <Typography variant="caption" sx={{ display: { xs: "none", sm: "inline" }, color: "text.secondary", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.username ?? "User"}
            </Typography>
          </IconButton>
          <Menu anchorEl={userAnchorEl} open={Boolean(userAnchorEl)} onClose={() => setUserAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem disabled dense><Typography variant="caption" sx={{ color: "text.disabled" }}>{user?.email ?? ""}</Typography></MenuItem>
            <MenuItem onClick={() => { setUserAnchorEl(null); navigate("/settings"); }} dense>Settings</MenuItem>
            <MenuItem onClick={() => { setUserAnchorEl(null); logout(); navigate("/login"); }} dense sx={{ color: "error.main" }}>Sign Out</MenuItem>
          </Menu>
        </Box>

        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      </Toolbar>
    </AppBar>
  );
}
