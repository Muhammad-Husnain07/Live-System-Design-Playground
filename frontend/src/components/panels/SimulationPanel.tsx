import { Square, Play, X, AlertTriangle, RefreshCw } from "lucide-react";
import { useSimulationStore, type SimConfig } from "../../store/simulationStore";

interface SimulationPanelProps {
  onStart: (overrides?: Partial<SimConfig>) => void;
  onStop: () => void;
}

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
    <aside className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 overflow-y-auto">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-surface-200">Simulation</h2>
          <ConnectionBadge status={connectionStatus} />
        </div>

        {isRunning && latestTick ? (
          <div className="space-y-4">
            <LiveStats tick={latestTick} elapsed={elapsed} formatTime={formatTime} />
            <button
              onClick={onStop}
              className="w-full py-2 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
            >
              <Square className="h-3 w-3" /> Stop Simulation
            </button>
          </div>
        ) : (
          <ConfigForm config={config} setConfig={setConfig} onStart={onStart} />
        )}
      </div>
    </aside>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500"
        : status === "error"
          ? "bg-red-500"
          : "bg-surface-600";
  return <span className={`w-2 h-2 rounded-full ${color}`} title={status} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-surface-500 mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

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
    <div className="space-y-4">
      <Field label="Traffic Pattern">
        <select
          value={config.trafficPattern}
          onChange={(e) => setConfig({ trafficPattern: e.target.value })}
          className="w-full bg-surface-800 text-surface-200 text-xs px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500"
        >
          <option value="steady">Steady</option>
          <option value="ramp_up">Ramp Up</option>
          <option value="spike">Spike</option>
        </select>
      </Field>

      <Field label="Target RPS">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={10000}
            value={config.targetRPS}
            onChange={(e) => setConfig({ targetRPS: Number(e.target.value) })}
            className="flex-1 accent-green-500 h-1"
          />
          <span className="text-xs text-surface-300 w-16 text-right tabular-nums">
            {config.targetRPS.toLocaleString()}
          </span>
        </div>
      </Field>

      <Field label="Duration (seconds)">
        <input
          type="number"
          min={5}
          max={3600}
          value={config.durationSeconds}
          onChange={(e) => setConfig({ durationSeconds: Math.max(5, Number(e.target.value)) })}
          className="w-full bg-surface-800 text-surface-200 text-xs px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500"
        />
      </Field>

      <Field label="Speed">
        <select
          value={config.speedMultiplier}
          onChange={(e) => setConfig({ speedMultiplier: Number(e.target.value) })}
          className="w-full bg-surface-800 text-surface-200 text-xs px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500"
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
        </select>
      </Field>

      <button
        onClick={onStart}
        className="w-full py-2 text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors"
      >
        <Play className="h-3 w-3" /> Start Simulation
      </button>
    </div>
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-900 rounded p-2.5 border border-surface-800">
            <div className="text-[9px] text-surface-500 uppercase tracking-wider mb-0.5">{s.label}</div>
            <div className="text-sm font-mono font-medium text-surface-100 tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-800 pt-3">
        <h3 className="text-[10px] text-surface-500 uppercase tracking-wider mb-2">Nodes</h3>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {tick.nodeMetrics.map((m) => (
            <div
              key={m.nodeId}
              className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${
                m.isFailed ? "bg-red-500/10" : m.isBottleneck ? "bg-orange-500/10" : "bg-surface-900"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {m.isFailed && <X className="h-3 w-3 text-red-400 shrink-0" />}
                {m.isBottleneck && !m.isFailed && <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />}
                {m.isAsync && !m.isBottleneck && !m.isFailed && (
                  <RefreshCw className="h-3 w-3 text-cyan-400 shrink-0" />
                )}
                <span className="text-surface-300 truncate">{m.label}</span>
              </div>
              <span className="text-surface-400 tabular-nums ml-2 shrink-0">
                {m.currentRPS.toLocaleString(undefined, { maximumFractionDigits: 0 })} RPS
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
