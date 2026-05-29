import { Square, Play, X, AlertTriangle, RefreshCw } from "lucide-react";
import { useSimulationStore, type SimConfig } from "../../store/simulationStore";
import { TextField, MenuItem, ButtonGroup, Button, Slider, Paper, Typography, Box } from "@mui/material";

interface SimulationPanelProps {
  onStart: (overrides?: Partial<SimConfig>) => void;
  onStop: () => void;
}

const SPEEDS = [1, 2, 5];

export default function SimulationPanel({ onStart, onStop }: SimulationPanelProps) {
  const config = useSimulationStore((s) => s.config);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const latestTick = useSimulationStore((s) => s.latestTick);
  const connectionStatus = useSimulationStore((s) => s.connectionStatus);
  const elapsed = useSimulationStore((s) => s.elapsed);
  const setConfig = useSimulationStore((s) => s.setConfig);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.875rem" }}>Simulation</Typography>
        <ConnectionBadge status={connectionStatus} />
      </Box>

      {isRunning && latestTick ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <LiveStats tick={latestTick} elapsed={elapsed} formatTime={formatTime} />
          <Button variant="contained" color="error" onClick={onStop} startIcon={<Square size={14} />} sx={{ fontSize: "0.75rem" }}>
            Stop Simulation
          </Button>
        </Box>
      ) : (
        <ConfigForm config={config} setConfig={setConfig} onStart={onStart} />
      )}
    </Box>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const color =
    status === "connected"
      ? "success.main"
      : status === "connecting"
        ? "warning.main"
        : status === "error"
          ? "error.main"
          : "text.disabled";
  return <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} title={status} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5, fontSize: "0.65rem" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

const sxSelect = { "& .MuiInputBase-root": { fontSize: "0.75rem" } };

function ConfigForm({
  config,
  setConfig,
  onStart,
}: {
  config: SimConfig;
  setConfig: (p: Partial<SimConfig>) => void;
  onStart: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Field label="Traffic Pattern">
        <TextField select fullWidth size="small" value={config.trafficPattern} onChange={(e) => setConfig({ trafficPattern: e.target.value })} sx={sxSelect}>
          <MenuItem value="steady">Steady</MenuItem>
          <MenuItem value="ramp_up">Ramp Up</MenuItem>
          <MenuItem value="spike">Spike</MenuItem>
        </TextField>
      </Field>

      <Field label="Target RPS">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Slider size="small" value={config.targetRPS} min={1} max={10000} onChange={(_, v) => setConfig({ targetRPS: v as number })} valueLabelDisplay="auto" sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", width: 64, textAlign: "right" }}>
            {config.targetRPS.toLocaleString()}
          </Typography>
        </Box>
      </Field>

      <Field label="Duration (seconds)">
        <TextField type="number" fullWidth size="small" value={config.durationSeconds}
          slotProps={{ htmlInput: { min: 5, max: 3600 } }}
          onChange={(e) => setConfig({ durationSeconds: Math.max(5, Number(e.target.value)) })}
        />
      </Field>

      <Field label="Speed">
        <ButtonGroup fullWidth size="small" sx={{ "& .MuiButton-root": { fontSize: "0.75rem" } }}>
          {SPEEDS.map((s) => (
            <Button key={s} variant={config.speedMultiplier === s ? "contained" : "outlined"} onClick={() => setConfig({ speedMultiplier: s })}>
              {s}x
            </Button>
          ))}
        </ButtonGroup>
      </Field>

      <Button variant="contained" color="success" onClick={onStart} startIcon={<Play size={14} />} sx={{ fontSize: "0.75rem" }}>
        Start Simulation
      </Button>
    </Box>
  );
}

function LiveStats({
  tick,
  elapsed,
  formatTime,
}: {
  tick: NonNullable<ReturnType<typeof useSimulationStore.getState>["latestTick"]>;
  elapsed: number;
  formatTime: (s: number) => string;
}) {
  const stats = [
    { label: "Total RPS", value: tick.totalRPS.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
    { label: "Error Rate", value: `${(tick.globalErrorRate * 100).toFixed(1)}%` },
    { label: "Active Req", value: tick.activeRequests.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
    { label: "Elapsed", value: formatTime(elapsed) },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        {stats.map((s) => (
          <Paper key={s.label} variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
            <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25, fontSize: "0.6rem" }}>
              {s.label}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 500, color: "text.primary", fontSize: "0.875rem" }}>
              {s.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <DividerSlim />

      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem" }}>
        Nodes
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 300, overflowY: "auto" }}>
        {tick.nodeMetrics.map((m) => (
          <Paper key={m.nodeId} variant="outlined" sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, py: 0.75,
            bgcolor: m.isFailed ? "rgba(239,68,68,0.1)" : m.isBottleneck ? "rgba(251,146,60,0.1)" : "action.hover",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              {m.isFailed && <X size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
              {m.isBottleneck && !m.isFailed && <AlertTriangle size={12} style={{ color: "#fb923c", flexShrink: 0 }} />}
              {m.isAsync && !m.isBottleneck && !m.isFailed && <RefreshCw size={12} style={{ color: "#22d3ee", flexShrink: 0 }} />}
              <Typography variant="caption" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.65rem" }}>
                {m.label}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", ml: 1, flexShrink: 0, fontSize: "0.65rem" }}>
              {m.currentRPS.toLocaleString(undefined, { maximumFractionDigits: 0 })} RPS
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

function DividerSlim() {
  return <Box sx={{ borderTop: 1, borderColor: "divider" }} />;
}
