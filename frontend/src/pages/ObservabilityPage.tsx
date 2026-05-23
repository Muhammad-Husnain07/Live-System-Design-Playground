import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSimulationStore } from "../store/simulationStore";
import { useChaosStore } from "../store/chaosStore";
import { useDeployStore } from "../store/deploymentStore";
import { useSecurityStore } from "../store/securityStore";
import { useProjectStore } from "../store/projectStore";
import html2canvas from "html2canvas";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api")
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");
import api from "../utils/api";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function formatMs(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

interface EventEntry {
  id: string;
  time: string;
  type: "simulation" | "chaos" | "deployment" | "security";
  icon: string;
  message: string;
  detail: string;
}

let eventCounter = 0;

export default function ObservabilityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dashRef = useRef<HTMLDivElement>(null);

  const ticks = useSimulationStore((s) => s.ticks);
  const latestTick = useSimulationStore((s) => s.latestTick);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const runId = useSimulationStore((s) => s.runId);
  const elapsed = useSimulationStore((s) => s.elapsed);

  const chaosEvents = useChaosStore((s) => s.activeEvents);
  const deployStates = useDeployStore((s) => s.nodeStates);
  const violations = useSecurityStore((s) => s.violations);

  const { currentProject } = useProjectStore();

  const [events, setEvents] = useState<EventEntry[]>([]);
  const [screenshotting, setScreenshotting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const addEvent = useCallback((type: EventEntry["type"], icon: string, message: string, detail: string) => {
    eventCounter += 1;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents((prev) => [{ id: `evt-${eventCounter}`, time, type, icon, message, detail }, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      if (!runId) return;
      try {
        const { data } = await api.post("/auth/ws-ticket");
        const ticket = data.ticket;
        const wsUrl = `${WS_BASE}/ws/simulation?ticket=${ticket}&projectId=${projectId}`;
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          addEvent("simulation", "▶", "Dashboard connected", `Listening to run ${runId.slice(0, 8)}…`);
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "tick") {
              useSimulationStore.getState().onTick(msg.tick);
            }
          } catch { /* skip */ }
        };
        ws.onclose = () => {
          if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        };
        ws.onerror = () => {};
        wsRef.current = ws;
      } catch { /* ignore */ }
    };

    connect();

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [projectId, runId, addEvent]);

  useEffect(() => {
    if (isRunning) {
      addEvent("simulation", "▶", "Simulation running", `${formatNum(elapsed)} elapsed`);
    } else {
      addEvent("simulation", "■", "Simulation stopped", "");
    }
  }, [isRunning, elapsed, addEvent]);

  useEffect(() => {
    if (chaosEvents.length > 0) {
      const latest = chaosEvents[chaosEvents.length - 1];
      addEvent("chaos", "☠", `Chaos: ${latest.eventType}`, `node ${latest.nodeId.slice(0, 8)}, severity ${Math.round(latest.severity * 100)}%`);
    }
  }, [chaosEvents, addEvent]);

  useEffect(() => {
    if (violations.length > 0 && events.length > 0) {
      const lastViolation = violations[violations.length - 1];
      const alreadyLogged = events.some((e) => e.type === "security" && e.message.includes(lastViolation.type));
      if (!alreadyLogged) {
        addEvent("security", "🛡", `Violation: ${lastViolation.type.replace(/_/g, " ")}`, lastViolation.message);
      }
    }
  }, [violations, addEvent, events.length]);

  useEffect(() => {
    const depKeys = Object.keys(deployStates);
    if (depKeys.length > 0 && events.length > 0) {
      const latestDep = depKeys[depKeys.length - 1];
      const state = deployStates[latestDep];
      const alreadyLogged = events.some((e) => e.type === "deployment" && e.detail.includes(latestDep));
      if (!alreadyLogged) {
        addEvent("deployment", "🚀", `Deployment: ${state.activeGroup}`, `node ${latestDep.slice(0, 8)} → ${state.activeGroup}`);
      }
    }
  }, [deployStates, addEvent, events.length]);

  const trafficData = useMemo(() => {
    return ticks.slice(-60).map((t) => ({
      tick: t.tickNumber,
      rps: Math.round(t.totalRPS),
      errors: Math.round(t.globalErrorRate * 1000) / 10,
    }));
  }, [ticks]);

  const errorBarData = useMemo(() => {
    if (!latestTick) return [];
    return latestTick.nodeMetrics
      .filter((m) => m.errorRate > 0)
      .map((m) => ({
        name: m.label.length > 14 ? m.label.slice(0, 14) + "…" : m.label,
        errorRate: Math.round(m.errorRate * 1000) / 10,
        rps: Math.round(m.currentRPS),
      }))
      .sort((a, b) => b.errorRate - a.errorRate);
  }, [latestTick]);

  const p99Latency = useMemo(() => {
    if (!latestTick || latestTick.nodeMetrics.length === 0) return 0;
    return Math.max(...latestTick.nodeMetrics.map((m) => m.p99LatencyMs ?? 0));
  }, [latestTick]);

  const handleScreenshot = useCallback(async () => {
    if (!dashRef.current) return;
    setScreenshotting(true);
    try {
      const canvas = await html2canvas(dashRef.current, {
        backgroundColor: "#09090b",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `observability-${projectId}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { /* ignore */ }
    setScreenshotting(false);
  }, [projectId]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="h-screen bg-surface-950 text-surface-100 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-surface-800 px-6 py-3 flex items-center justify-between bg-surface-950/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
            title="Back to Project"
          >
            &larr;
          </button>
          <h1 className="text-lg font-semibold text-surface-100">Observability</h1>
          <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded">{currentProject?.name ?? projectId}</span>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="text-[10px] font-mono text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live {formatTime(elapsed)}
            </span>
          )}
          {!isRunning && (
            <span className="text-[10px] text-surface-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-600" />
              Idle
            </span>
          )}
          <button
            onClick={handleScreenshot}
            disabled={screenshotting}
            className="px-3 py-1.5 text-[11px] font-medium bg-surface-800 hover:bg-surface-700 text-surface-300 rounded transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {screenshotting ? "Capturing…" : "📷 Screenshot Dashboard"}
          </button>
        </div>
      </header>

      <div ref={dashRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Total RPS" value={formatNum(latestTick?.totalRPS ?? 0)} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" />
            <KpiCard label="Error Rate" value={latestTick ? formatPct(latestTick.globalErrorRate) : "0%"} color={latestTick && latestTick.globalErrorRate > 0.05 ? "text-red-400" : "text-surface-200"} bg={latestTick && latestTick.globalErrorRate > 0.05 ? "bg-red-500/10" : "bg-surface-800"} border={latestTick && latestTick.globalErrorRate > 0.05 ? "border-red-500/20" : "border-surface-700"} />
            <KpiCard label="p99 Latency" value={formatMs(p99Latency)} color={p99Latency > 500 ? "text-orange-400" : "text-purple-400"} bg={p99Latency > 500 ? "bg-orange-500/10" : "bg-purple-500/10"} border={p99Latency > 500 ? "border-orange-500/20" : "border-purple-500/20"} />
            <KpiCard label="Active Requests" value={formatNum(latestTick?.activeRequests ?? 0)} color="text-cyan-400" bg="bg-cyan-500/10" border="border-cyan-500/20" />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 bg-surface-900 rounded-lg border border-surface-800 p-4">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-3">Traffic Over Time (last 60 ticks)</p>
              {trafficData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="tick" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#e4e4e7" }} />
                    <Line type="monotone" dataKey="rps" stroke="#3b82f6" strokeWidth={2} dot={false} name="RPS" />
                    <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Errors %" strokeDasharray="4 3" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[10px] text-surface-600">Waiting for tick data…</div>
              )}
            </div>

            <div className="bg-surface-900 rounded-lg border border-surface-800 p-4">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-3">Error Rate by Node</p>
              {errorBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={errorBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#e4e4e7" }} formatter={(value) => [`${Number(value)}%`, "Error Rate"]} />
                    <Bar dataKey="errorRate" fill="#ef4444" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[10px] text-surface-600">No errors</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-3">Node Health</p>
              {latestTick && latestTick.nodeMetrics.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {latestTick.nodeMetrics.map((m) => (
                    <div
                      key={m.nodeId}
                      className={`bg-surface-900 rounded-lg border p-3 space-y-2 ${
                        m.isFailed ? "border-red-500/40" : m.isBottleneck ? "border-orange-500/30" : "border-surface-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-surface-200 truncate flex-1">{m.label}</span>
                        <span
                          className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
                            m.isFailed ? "bg-red-500/20 text-red-400" : m.isBottleneck ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {m.isFailed ? "DOWN" : m.isBottleneck ? "DEG" : "OK"}
                        </span>
                      </div>
                      <GaugeBar label="CPU" value={m.cpuPercent} danger />
                      <GaugeBar label="MEM" value={m.memoryPercent} danger={false} />
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-surface-500">RPS</span>
                        <span className="font-mono text-surface-300 tabular-nums">{formatNum(m.currentRPS)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[120px] bg-surface-900 rounded-lg border border-surface-800 flex items-center justify-center text-[10px] text-surface-600">
                  No node metrics available
                </div>
              )}
            </div>

            <div className="bg-surface-900 rounded-lg border border-surface-800 p-4 flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 font-medium mb-3 shrink-0">Event Log</p>
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800 space-y-1 min-h-0">
                {events.length === 0 ? (
                  <p className="text-[10px] text-surface-600 text-center py-4">No events yet</p>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-800 transition-colors">
                      <span className="text-xs shrink-0 mt-0.5">{ev.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium text-surface-200 truncate">{ev.message}</span>
                          <span className="text-[8px] text-surface-600 shrink-0 ml-auto">{ev.time}</span>
                        </div>
                        {ev.detail && (
                          <p className="text-[8px] text-surface-500 truncate">{ev.detail}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, bg, border }: { label: string; value: string; color: string; bg: string; border: string }) {
  return (
    <div className={`${bg} ${border} rounded-lg border p-4`}>
      <p className="text-[9px] uppercase tracking-wider text-surface-500 font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function GaugeBar({ label, value, danger }: { label: string; value: number; danger: boolean }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[8px] mb-0.5">
        <span className="text-surface-500">{label}</span>
        <span className="font-mono text-surface-400">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 80 ? "#EF4444" : danger ? "#F97316" : "#3B82F6",
          }}
        />
      </div>
    </div>
  );
}
