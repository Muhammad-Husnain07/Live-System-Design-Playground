import { useState, useEffect, useRef, useCallback } from "react";
import { Skull } from "lucide-react";
import { useChaosStore, CHAOS_TYPES, type ChaosEventData } from "../../store/chaosStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../ui/EmptyState";
import { useSimulationStore } from "../../store/simulationStore";
import api from "../../utils/api";
import { Alert, Card, Box, Typography, Select, MenuItem, Slider, TextField, Button } from "@mui/material";

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
      useChaosStore.getState().setLastChaosInjectionAt(Date.now());
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
    <Card
      variant="outlined"
      sx={{ position: "absolute", left: 0, top: "100%", mt: 0.5, width: 256, zIndex: 50, p: 1.5, display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "background.paper", borderColor: "divider" }}
    >
      <Typography variant="caption" sx={{ color: "#a1a1aa", lineHeight: 1.4 }}>{definition.description}</Typography>

      <Box>
        <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 0.5, fontSize: "0.7rem" }}>Target Node</Typography>
        <Select
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          size="small"
          displayEmpty
          fullWidth
          sx={{ fontSize: "0.7rem", bgcolor: "background.elevated", color: "#f4f4f5", "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#ef4444" } }}
        >
          <MenuItem value="" disabled sx={{ fontSize: "0.7rem" }}>Select a node...</MenuItem>
          {nodes.map((n) => (
            <MenuItem key={n.id} value={n.id} sx={{ fontSize: "0.7rem" }}>{n.data?.label ?? n.id}</MenuItem>
          ))}
        </Select>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 0.5, fontSize: "0.7rem" }}>
          Severity: {Math.round(severity * 100)}%
        </Typography>
        <Slider
          value={severity}
          onChange={(_, v) => setSeverity(v as number)}
          min={0.05}
          max={1}
          step={0.05}
          size="small"
          sx={{ color: "#ef4444", "& .MuiSlider-thumb": { width: 12, height: 12 } }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#52525b" }}>5%</Typography>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#52525b" }}>100%</Typography>
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: "#71717a", display: "block", mb: 0.5, fontSize: "0.7rem" }}>Duration (seconds)</Typography>
        <TextField
          type="number"
          size="small"
          value={durationSec}
          onChange={(e) => setDurationSec(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
          slotProps={{ htmlInput: { min: 1, max: 300, style: { fontSize: "0.7rem", color: "#f4f4f5" } } }}
          sx={{ "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" }, "& .MuiInputBase-root": { bgcolor: "background.elevated" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#ef4444" } }}
        />
      </Box>

      <Button
        onClick={handleInject}
        disabled={!selectedNodeId || injecting}
        variant="contained"
        size="small"
        sx={{ bgcolor: "rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.7rem", "&:hover": { bgcolor: "rgba(239,68,68,0.3)" }, "&.Mui-disabled": { opacity: 0.3, color: "#ef4444" } }}
      >
        {injecting ? "Injecting..." : "Inject Chaos"}
      </Button>
    </Card>
  );
}

function ChaosCard({ definition }: { definition: (typeof CHAOS_TYPES)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ position: "relative" }}>
      <Card
        variant="outlined"
        onClick={() => setOpen((v) => !v)}
        sx={{
          p: 1.25, cursor: "pointer", bgcolor: "background.paper", borderColor: "divider",
          transition: "all 0.15s", "&:hover": { borderColor: "rgba(239,68,68,0.4)", bgcolor: "background.elevated" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <definition.icon size={16} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: "#f4f4f5", display: "block", fontSize: "0.7rem" }}>{definition.label}</Typography>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#71717a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mt: 0.25 }}>
              {definition.description}
            </Typography>
          </Box>
        </Box>
      </Card>
      {open && <ChaosConfigPopover definition={definition} onClose={() => setOpen(false)} />}
    </Box>
  );
}

function ActiveEventRow({ event, onRemove }: { event: ChaosEventData; onRemove: (id: string) => void }) {
  const def = CHAOS_TYPES.find((d) => d.type === event.eventType);
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeLabel = nodes.find((n) => n.id === event.nodeId)?.data?.label ?? event.nodeId;

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
    <Card variant="outlined" sx={{ p: 1, bgcolor: "background.paper", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          {def ? <def.icon size={16} /> : <Typography variant="caption">?</Typography>}
          <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 500, color: "#f4f4f5" }}>{def?.label ?? event.eventType}</Typography>
        </Box>
        {totalSec > 0 && (
          <Typography variant="caption" sx={{ fontSize: "0.65rem", fontFamily: "monospace", color: "#a1a1aa", flexShrink: 0 }}>{fmt(remaining)}</Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.25 }}>
        <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#71717a" }}>{nodeLabel}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 64, height: 6, bgcolor: "background.elevated", borderRadius: "999px", overflow: "hidden" }}>
            <Box sx={{ height: "100%", borderRadius: "999px", transition: "width 0.5s", bgcolor: def?.color ?? "#EF4444", width: `${severityPct}%` }} />
          </Box>
          <Button onClick={() => onRemove(event.id)} size="small" sx={{ minWidth: 0, p: 0, color: "#52525b", fontSize: "0.6rem" }}>x</Button>
        </Box>
      </Box>
    </Card>
  );
}

import { useShallow } from "zustand/react/shallow";

export default function ChaosPanel() {
  const { activeEvents, setActiveEvents, removeActiveEvent } = useChaosStore(useShallow((s) => ({ activeEvents: s.activeEvents, setActiveEvents: s.setActiveEvents, removeActiveEvent: s.removeActiveEvent })));
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <Skull size={16} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#f4f4f5", fontSize: "0.75rem" }}>Chaos Engineering</Typography>
        {activeEvents.length > 0 && (
          <Typography variant="caption" sx={{ ml: "auto", fontSize: "0.6rem", bgcolor: "rgba(239,68,68,0.2)", px: 0.75, py: 0.25, borderRadius: "999px", fontFamily: "monospace", color: "#ef4444" }}>
            {activeEvents.length}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 1 }}>
        <Alert severity="warning" sx={{ mb: 1.5, py: 0.5, fontSize: "0.7rem", "& .MuiAlert-icon": { fontSize: "1rem", py: 0 } }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Danger Zone</Typography>
        </Alert>

        <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#52525b", display: "block", mb: 1 }}>
          Inject Fault
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
          {CHAOS_TYPES.map((def) => (
            <ChaosCard key={def.type} definition={def} />
          ))}
        </Box>
      </Box>

      {activeEvents.length > 0 && (
        <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#52525b", display: "block", mb: 1 }}>
            Active Events ({activeEvents.length})
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {activeEvents.map((ev) => (
              <ActiveEventRow key={ev.id} event={ev} onRemove={(id) => removeActiveEvent(id)} />
            ))}
          </Box>
        </Box>
      )}

      {activeEvents.length === 0 && (
        <Box sx={{ px: 1.5, py: 1 }}>
          <EmptyState icon="!" title="No active chaos events" description="Select a chaos type above and inject a fault into a node." />
        </Box>
      )}
    </Box>
  );
}
