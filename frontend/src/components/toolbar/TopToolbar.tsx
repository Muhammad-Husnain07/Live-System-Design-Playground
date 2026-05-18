import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useAuthStore } from "../../store/authStore";
import { useExportStore } from "../../store/exportStore";
import ImportModal from "../panels/ImportModal";

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
  collabConnected: boolean;
  remoteUsers: { clientId: number; name: string; color: string }[];
}

export default function TopToolbar({ projectId, saving, onStart, onStop, showSimPanel, onToggleSimPanel, showChaosPanel, onToggleChaosPanel, showDeployPanel, onToggleDeployPanel, showSecurityPanel, onToggleSecurityPanel, collabConnected, remoteUsers }: TopToolbarProps) {
  const navigate = useNavigate();
  const { currentProject, updateProject } = useProjectStore();
  const { user, logout } = useAuthStore();

  /* ---- canvas store ---- */
  const isDirty = useCanvasStore((s) => s.isDirty);
  const lastSaved = useCanvasStore((s) => s.lastSaved);
  const pastStates = useCanvasStore((s) => s.pastStates);
  const futureStates = useCanvasStore((s) => s.futureStates);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const isSimRunning = useCanvasStore((s) => s.isSimulationRunning);
  const simSpeed = useCanvasStore((s) => s.simulationSpeed);
  const setSimSpeed = useCanvasStore((s) => s.setSimulationSpeed);

  /* ---- export ---- */
  const openExport = useExportStore((s) => s.openExport);

  /* ---- inline name edit ---- */
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

  /* ---- simulation timer ---- */
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

  /* ---- import modal ---- */
  const [showImport, setShowImport] = useState(false);

  /* ---- export dropdown ---- */
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ---- user dropdown ---- */
  const [showUser, setShowUser] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ---- save indicator ---- */
  const saveLabel = saving ? "Saving..." : isDirty ? "Unsaved changes" : lastSaved ? "Saved" : "";
  const saveColor = saving ? "text-yellow-400" : isDirty ? "text-orange-400" : "text-green-500";

  return (
    <header className="h-[52px] shrink-0 bg-surface-950 border-b border-surface-800 flex items-center px-4 gap-2 select-none">
      {/* ── Left section ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-surface-400 hover:text-surface-200 transition-colors shrink-0"
          title="Back to Dashboard"
        >
          &larr;
        </button>

        {/* Inline editable project name */}
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
            className="bg-surface-800 text-surface-100 text-sm font-medium px-1.5 py-0.5 rounded border border-surface-600 outline-none w-48"
          />
        ) : (
          <button
            onClick={startEditing}
            className="text-sm font-medium text-surface-100 hover:text-blue-400 transition-colors truncate max-w-[200px]"
            title="Click to rename"
          >
            {currentProject?.name || "Project"}
          </button>
        )}

        {/* Role badge */}
        {currentProject?.role && (
          <span className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded shrink-0">
            {currentProject.role}
          </span>
        )}

        {/* Save indicator */}
        <span className={`text-[10px] ${saveColor} shrink-0`}>{saveLabel}</span>
      </div>

      {/* ── Center section ── */}
      <div className="flex items-center justify-center flex-1 gap-2">
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

        <div className="w-px h-4 bg-surface-700 mx-1" />

        {/* Run / Stop */}
        <button
          onClick={() => (isSimRunning ? onStop() : onStart())}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            isSimRunning
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
          }`}
        >
          {isSimRunning ? "■ Stop" : "▶ Run"}
        </button>

        {/* Speed selector */}
          <select
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="bg-surface-800 text-surface-200 text-[10px] px-1.5 py-1 rounded border border-surface-700 focus:outline-none focus:border-blue-500"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </select>

        {/* Timer */}
        {isSimRunning && (
          <span className="text-[11px] font-mono text-surface-400 tabular-nums">
            {formatTime(elapsed)}
          </span>
        )}
      </div>

      {/* ── Right section ── */}
      <div className="flex items-center gap-2">
        {/* Collaborators */}
        <button
          className="px-2 py-1 text-[10px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
          title="Manage collaborators"
        >
          👥
        </button>

        {/* Share */}
        <button
          className="px-2 py-1 text-[10px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
          title="Share project"
        >
          Share
        </button>

        {/* Import */}
        <button
          onClick={() => setShowImport(true)}
          className="px-2 py-1 text-[10px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
          title="Import IaC file"
        >
          Import
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExport((v) => !v)}
            className="px-2 py-1 text-[10px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
          >
            Export ▾
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-surface-900 border border-surface-700 rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => { setShowExport(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                📷 Export as PNG
              </button>
              <button
                onClick={() => { setShowExport(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                📄 Export as JSON
              </button>
              <div className="border-t border-surface-700 my-1" />
              <button
                onClick={() => { setShowExport(false); openExport(); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-green-400 hover:bg-green-900/20 transition-colors"
              >
                🏗️ IaC Export
              </button>
            </div>
          )}
        </div>

        {/* Simulation panel toggle */}
        <button
          onClick={onToggleSimPanel}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${
            showSimPanel
              ? "bg-green-500/20 text-green-400"
              : "bg-surface-800 hover:bg-surface-700 text-surface-300"
          }`}
          title="Simulation Panel"
        >
          Sim
        </button>

        {/* Chaos Engineering toggle */}
        <button
          onClick={onToggleChaosPanel}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${
            showChaosPanel
              ? "bg-red-500/20 text-red-400"
              : "bg-surface-800 hover:bg-surface-700 text-surface-300"
          }`}
          title="Chaos Engineering Panel"
        >
          ☠️
        </button>

        {/* Deployment toggle */}
        <button
          onClick={onToggleDeployPanel}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${
            showDeployPanel
              ? "bg-purple-500/20 text-purple-400"
              : "bg-surface-800 hover:bg-surface-700 text-surface-300"
          }`}
          title="Deployment Panel"
        >
          🚀
        </button>

        {/* Security toggle */}
        <button
          onClick={onToggleSecurityPanel}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${
            showSecurityPanel
              ? "bg-blue-500/20 text-blue-400"
              : "bg-surface-800 hover:bg-surface-700 text-surface-300"
          }`}
          title="Security Audit Panel"
        >
          🛡️
        </button>

        {/* Remote users */}
        {collabConnected && remoteUsers.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {remoteUsers.map((u) => (
              <div
                key={u.clientId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border border-surface-950"
                style={{ background: u.color }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        <div className="w-px h-4 bg-surface-700 mx-0.5" />

        {/* Observability */}
        <button
          onClick={() => navigate(`/project/${projectId}/observe`)}
          className="px-2 py-1 text-[10px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
        >
          📊
        </button>

        {/* User dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUser((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] bg-surface-800 hover:bg-surface-700 rounded transition-colors text-surface-300"
          >
            <span className="w-4 h-4 rounded-full bg-green-500/20 text-green-400 text-[9px] flex items-center justify-center font-medium">
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </span>
            <span className="hidden sm:inline max-w-[80px] truncate">{user?.username ?? "User"}</span>
          </button>
          {showUser && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface-900 border border-surface-700 rounded-lg shadow-xl z-50 py-1">
              <div className="px-3 py-1.5 text-[10px] text-surface-500 border-b border-surface-800 truncate">
                {user?.email ?? ""}
              </div>
              <button
                onClick={() => { setShowUser(false); navigate("/settings"); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-surface-300 hover:bg-surface-800 hover:text-surface-100 transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => { setShowUser(false); logout(); navigate("/login"); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-surface-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
      />
    </header>
  );
}
