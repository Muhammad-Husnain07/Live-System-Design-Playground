import { useState, useEffect, useRef, useCallback } from "react";
import { useChaosStore, CHAOS_TYPES, type ChaosEventData } from "../../store/chaosStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../ui/EmptyState";
import { useSimulationStore } from "../../store/simulationStore";
import api from "../../utils/api";

/* ── Popover for a single chaos card ── */
function ChaosConfigPopover({
  definition,
  onClose,
}: {
  definition: (typeof CHAOS_TYPES)[number];
  onClose: () => void;
}) {
  const [severity, setSeverity] = useState(0.5);
  const [durationSec, setDurationSec] = useState(15);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [injecting, setInjecting] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const addActiveEvent = useChaosStore((s) => s.addActiveEvent);
  const runId = useSimulationStore((s) => s.runId);
  const nodes = useCanvasStore((s) => s.nodes);

  const handleInject = useCallback(async () => {
    if (!runId || !selectedNodeId) return;
    setInjecting(true);
    try {
      const resp = await api.post("/chaos/inject", {
        simulationRunId: runId,
        nodeId: selectedNodeId,
        eventType: definition.type,
        severity,
        durationSeconds: durationSec,
      });
      const event = resp.data.event as ChaosEventData;
      addActiveEvent(event);
      addToast({
        type: "warning",
        title: `Chaos injected: ${definition.label}`,
        message: `Severity ${Math.round(severity * 100)}% on ${nodes.find((n) => n.id === selectedNodeId)?.data?.label ?? selectedNodeId} for ${durationSec}s`,
        duration: 5000,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to inject chaos";
      addToast({ type: "error", title: "Chaos injection failed", message: msg, duration: 5000 });
    } finally {
      setInjecting(false);
    }
  }, [runId, selectedNodeId, definition, severity, durationSec, addActiveEvent, addToast, onClose, nodes]);

  return (
    <div className="absolute left-0 top-full mt-1 w-64 bg-surface-900 border border-surface-700 rounded-lg shadow-2xl z-50 p-3 space-y-3">
      <p className="text-[10px] text-surface-400 leading-relaxed">{definition.description}</p>

      <div>
        <label className="text-[9px] text-surface-500 block mb-1">Target Node</label>
        <select
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          className="w-full bg-surface-800 text-surface-200 text-[11px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-red-500"
        >
          <option value="">Select a node...</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data?.label ?? n.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[9px] text-surface-500 block mb-1">
          Severity: {Math.round(severity * 100)}%
        </label>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          className="w-full accent-red-500"
        />
        <div className="flex justify-between text-[8px] text-surface-600 mt-0.5">
          <span>5%</span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <label className="text-[9px] text-surface-500 block mb-1">Duration (seconds)</label>
        <input
          type="number"
          min={1}
          max={300}
          value={durationSec}
          onChange={(e) => setDurationSec(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
          className="w-full bg-surface-800 text-surface-200 text-[11px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-red-500"
        />
      </div>

      <button
        onClick={handleInject}
        disabled={!selectedNodeId || injecting}
        className="w-full py-1.5 text-[11px] font-medium rounded transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {injecting ? "Injecting..." : "Inject Chaos"}
      </button>
    </div>
  );
}

/* ── Single chaos type card ── */
function ChaosCard({ definition }: { definition: (typeof CHAOS_TYPES)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left bg-surface-900 hover:bg-surface-800 border border-surface-800 hover:border-red-500/40 rounded-lg p-2.5 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{definition.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-surface-200 truncate">{definition.label}</p>
            <p className="text-[9px] text-surface-500 leading-tight mt-0.5 line-clamp-2">{definition.description}</p>
          </div>
        </div>
      </button>
      {open && <ChaosConfigPopover definition={definition} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ── Active event row with countdown ── */
function ActiveEventRow({ event, onRemove }: { event: ChaosEventData; onRemove: (id: string) => void }) {
  const def = CHAOS_TYPES.find((d) => d.type === event.eventType);
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeLabel = nodes.find((n) => n.id === event.nodeId)?.data?.label ?? event.nodeId;

  /* inject time tracking */
  const injectedAtRef = useRef(Date.now());
  const totalSec = event.durationTicks / 10;
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    if (totalSec <= 0) return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - injectedAtRef.current) / 1000;
      const left = Math.max(0, totalSec - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [totalSec]);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const severityPct = Math.round(event.severity * 100);

  return (
    <div className="bg-surface-900 border border-surface-800 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{def?.icon ?? "?"}</span>
          <span className="text-[10px] font-medium text-surface-200 truncate">{def?.label ?? event.eventType}</span>
        </div>
        {totalSec > 0 && (
          <span className="text-[10px] font-mono text-surface-400 shrink-0">{fmt(remaining)}</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-surface-500 truncate">{nodeLabel}</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${severityPct}%`, backgroundColor: def?.color ?? "#EF4444" }}
            />
          </div>
          <button
            onClick={() => onRemove(event.id)}
            className="text-[9px] text-surface-600 hover:text-red-400 transition-colors shrink-0"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ChaosPanel ── */
export default function ChaosPanel() {
  const { activeEvents, setActiveEvents, removeActiveEvent } = useChaosStore();
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Poll active events every 3s during simulation */
  useEffect(() => {
    if (!runId || !isRunning) {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const resp = await api.get(`/chaos/active/${runId}`);
        setActiveEvents(resp.data.events ?? []);
      } catch { /* ignore */ }
    };
    poll();
    pollTimer.current = setInterval(poll, 3000);
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, [runId, isRunning, setActiveEvents]);

  /* Reset events on unmount */
  useEffect(() => {
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, []);

  return (
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
        <span className="text-sm">☠️</span>
        <span className="text-xs font-semibold text-surface-100">Chaos Engineering</span>
        {activeEvents.length > 0 && (
          <span className="ml-auto text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">
            {activeEvents.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        {/* ── Inject Section ── */}
        <div className="px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-surface-600 font-medium mb-2">Inject Fault</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CHAOS_TYPES.map((def) => (
              <ChaosCard key={def.type} definition={def} />
            ))}
          </div>
        </div>

        {/* ── Active Events ── */}
        {activeEvents.length > 0 && (
          <div className="px-3 py-2 border-t border-surface-800">
            <p className="text-[9px] uppercase tracking-wider text-surface-600 font-medium mb-2">
              Active Events ({activeEvents.length})
            </p>
            <div className="space-y-1.5">
              {activeEvents.map((ev) => (
                <ActiveEventRow key={ev.id} event={ev} onRemove={(id) => removeActiveEvent(id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {activeEvents.length === 0 && (
          <div className="px-3 py-2">
            <EmptyState
              icon="!"
              title="No active chaos events"
              description="Select a chaos type above and inject a fault into a node."
            />
          </div>
        )}
      </div>
    </div>
  );
}
