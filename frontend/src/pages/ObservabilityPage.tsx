import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSimulationStore, type TickData, type NodeMetricsSnapshot } from "../store/simulationStore";
import { useChaosStore } from "../store/chaosStore";
import { useDeployStore } from "../store/deploymentStore";
import { useSecurityStore } from "../store/securityStore";
import { useProjectStore } from "../store/projectStore";
import html2canvas from "html2canvas";
import { Camera, ArrowLeft, Search, Terminal } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "../utils/api";

const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api")
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#27272a" };
const CHART_TICK = { fontSize: 9, fill: "#71717a" };
const TOOLTIP_STYLE = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11, maxHeight: 200, overflowY: "auto" as const };
const TOOLTIP_LABEL = { color: "#e4e4e7" };

/* ── helpers ── */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function ms(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

/* ── RED Metrics per service ── */

interface RedDatum {
  tick: number;
  rate: number;
  errors: number;
  p50: number;
  p90: number;
  p99: number;
}

function computeRedMetrics(ticks: TickData[], label: string): RedDatum[] {
  return ticks.slice(-120).map((t) => {
    const nodes = t.nodeMetrics.filter((m) => m.label === label);
    const agg = nodes.reduce(
      (a, n) => ({
        rate: a.rate + n.currentRPS,
        errors: a.errors + n.errorCount,
        p99: Math.max(a.p99, n.p99LatencyMs ?? 0),
        latency: Math.max(a.latency, n.latencyMs ?? 0),
      }),
      { rate: 0, errors: 0, p99: 0, latency: 0 }
    );
    return {
      tick: t.tickNumber,
      rate: Math.round(agg.rate),
      errors: Math.round(agg.errors),
      p50: Math.round(agg.latency * 1.2),
      p90: Math.round(agg.p99 * 0.7),
      p99: Math.round(agg.p99),
    };
  });
}

const RedChart = memo(function RedChart({ data, label }: { data: RedDatum[]; label: string }) {
  if (data.length <= 1) {
    return <div className="h-[140px] flex items-center justify-center text-[10px]" style={{ color: '#52525b' }}>Waiting for data…</div>;
  }
  return (
    <div className="bg-surface-900 rounded-lg border border-surface-800 p-3">
      <p className="text-[10px] font-medium mb-2" style={{ color: '#a1a1aa' }}>{label}</p>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="tick" tick={CHART_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
          <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Rate (RPS)" />
          <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Errors" />
          <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={1} dot={false} name="p50 ms" strokeDasharray="2 2" />
          <Line type="monotone" dataKey="p90" stroke="#f59e0b" strokeWidth={1} dot={false} name="p90 ms" strokeDasharray="4 3" />
          <Line type="monotone" dataKey="p99" stroke="#a78bfa" strokeWidth={1.5} dot={false} name="p99 ms" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

/* ── Trace Explorer ── */

interface SpanData {
  spanId: string;
  traceId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  entryTime: string;
  exitTime: string;
  durationMs: number;
  status: "OK" | "ERROR";
  spanType?: "CACHE_HIT" | "ASYNC_WAIT" | "";
}

interface TraceData {
  traceId: string;
  spans: SpanData[];
  rootNodeId: string;
  rootNodeLabel: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  status: "OK" | "ERROR";
  hasError: boolean;
}

const TraceRow = memo(function TraceRow({ trace, onSelect, selected }: { trace: TraceData; onSelect: () => void; selected: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors text-[11px] ${
        selected ? "bg-blue-500/20 border border-blue-500/40" : "hover:bg-surface-800 border border-transparent"
      }`}
      onClick={onSelect}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${trace.status === "ERROR" ? "bg-red-400" : "bg-green-400"}`} />
      <span className="font-mono w-28 truncate" style={{ color: '#a1a1aa' }}>{trace.traceId.slice(0, 8)}…</span>
      <span className="w-20 truncate" style={{ color: '#71717a' }}>{trace.rootNodeLabel}</span>
      <span className="font-mono w-16 text-right" style={{ color: '#a1a1aa' }}>{ms(trace.totalDurationMs)}</span>
      <span className="w-14 text-right" style={{ color: trace.status === "ERROR" ? '#ef4444' : '#22c55e' }}>{trace.status}</span>
      <span className="text-[9px] ml-auto" style={{ color: '#52525b' }}>{trace.spans.length} spans</span>
    </div>
  );
});

function WaterfallChart({ trace }: { trace: TraceData }) {
  const maxDur = Math.max(...trace.spans.map((s) => s.durationMs), 1);
  return (
    <div className="space-y-1 text-[11px] mt-2">
      <p className="text-[10px] font-medium mb-2" style={{ color: '#a1a1aa' }}>
        Trace <span className="font-mono" style={{ color: '#f4f4f5' }}>{trace.traceId.slice(0, 12)}…</span>
        {" · "}
        {trace.spans.length} spans · {ms(trace.totalDurationMs)} total
        {trace.hasError && <span className="ml-2" style={{ color: '#ef4444' }}>⛔ Has Errors</span>}
      </p>
      <div className="border border-surface-800 rounded overflow-hidden">
        {/* header */}
        <div className="flex bg-surface-800 text-[9px] font-medium px-3 py-1.5" style={{ color: '#71717a' }}>
          <span className="w-40 shrink-0">Service</span>
          <span className="w-14 shrink-0 text-right">Duration</span>
          <div className="flex-1 ml-2 relative h-4">
            <span className="absolute left-0 top-0">0</span>
            <span className="absolute right-0 top-0">{ms(maxDur)}</span>
          </div>
        </div>
        {trace.spans.map((span, i) => {
          const pct = maxDur > 0 ? (span.durationMs / maxDur) * 100 : 0;
          const offset = 0;
          const isError = span.status === "ERROR";
          const isCache = span.spanType === "CACHE_HIT";
          const isAsync = span.spanType === "ASYNC_WAIT";
          let barColor = "#3b82f6";
          if (isError) barColor = "#ef4444";
          else if (isCache) barColor = "#10b981";
          else if (isAsync) barColor = "#f59e0b";
          return (
            <div
              key={span.spanId}
              className={`flex items-center px-3 py-2 ${i % 2 === 0 ? "bg-surface-900" : "bg-surface-950"} ${
                isError ? "bg-red-500/5" : ""
              }`}
            >
              <span className="w-40 shrink-0 truncate flex items-center gap-1" style={{ color: '#f4f4f5' }}>
                {isCache && <span className="text-[9px]" style={{ color: '#22c55e' }}>●</span>}
                {isAsync && <span className="text-[9px]" style={{ color: '#f97316' }}>◉</span>}
                {isError && <span className="text-[9px]" style={{ color: '#ef4444' }}>⛔</span>}
                {span.nodeLabel}
                <span className="text-[9px] ml-1" style={{ color: '#71717a' }}>{span.nodeType}</span>
              </span>
              <span className="w-14 shrink-0 text-right font-mono" style={{ color: '#a1a1aa' }}>{ms(span.durationMs)}</span>
              <div className="flex-1 ml-2 relative h-4">
                <div
                  className="absolute top-0.5 h-3 rounded-full opacity-80"
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Structured Log Tail ── */

interface LogEntry {
  timestamp: string;
  service: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  traceId: string;
}

const logMessages: Record<string, string[]> = {
  AppServer: [
    "Connection pool exhausted", "Request processed in {n}ms", "Cache miss for key {key}",
    "Slow query detected ({n}s)", "Session token refreshed", "Rate limit approaching for client {id}",
  ],
  Microservice: [
    "gRPC call failed with code UNAVAILABLE", "Circuit breaker opened for downstream {svc}",
    "Retry attempt {n}/3 for order service", "Payload too large ({n}KB)", "Deserialization error on topic {topic}",
  ],
  WebServer: [
    "404 on route /api/{path}", "Static asset served from cache", "CSRF token validation failed",
    "Request aborted: client disconnected", "TLS handshake error from {ip}",
  ],
  PostgreSQLDB: [
    "Vacuum running on table {table}", "Deadlock detected, rollback transaction",
    "Long-running query ({n}s): SELECT * FROM {table}", "Connection limit reached, rejecting",
    "WAL file archived at offset {n}",
  ],
  Redis: [
    "Key evicted by LRU policy", "Cluster slot migration complete",
    "Replication backlog overflow", "OMEM watchdog triggered",
    "Pipeline execution failed at command #{n}",
  ],
  LoadBalancer: [
    "Backend {svc} marked unhealthy", "Connection draining for target {id}",
    "SSL certificate rotation in progress", "Sticky session affinity lost",
    "Upstream connect error ({code})",
  ],
  MessageQueue: [
    "Consumer group rebalancing", "Dead-letter queue depth: {n}",
    "Message retention policy exceeded", "Partition leader re-elected",
    "Batch acknowledgement timed out",
  ],
};

const logLevels: ("INFO" | "WARN" | "ERROR")[] = ["INFO", "INFO", "INFO", "WARN", "ERROR"];

function fillTemplate(msg: string): string {
  return msg
    .replace(/\{n\}/g, String(Math.floor(Math.random() * 9000) + 100))
    .replace(/\{key\}/g, ["user:1234", "session:abc", "cache:doc_v2", "rate:limit:ip"][Math.floor(Math.random() * 4)])
    .replace(/\{id\}/g, String(Math.floor(Math.random() * 9999) + 1))
    .replace(/\{svc\}/g, ["payment", "inventory", "notification", "auth"][Math.floor(Math.random() * 4)])
    .replace(/\{topic\}/g, ["orders.created", "payments.confirmed", "users.updated"][Math.floor(Math.random() * 3)])
    .replace(/\{path\}/g, ["users", "orders", "payments", "products"][Math.floor(Math.random() * 4)])
    .replace(/\{ip\}/g, `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`)
    .replace(/\{table\}/g, ["users", "orders", "products", "inventory"][Math.floor(Math.random() * 4)])
    .replace(/\{code\}/g, String(Math.floor(Math.random() * 500) + 100));
}

function generateLogEntry(tick: TickData, traces: TraceData[]): LogEntry {
  const svcTypes = Object.keys(logMessages);
  const svcType = svcTypes[Math.floor(Math.random() * svcTypes.length)];
  const msgs = logMessages[svcType] || logMessages.AppServer;
  const msg = fillTemplate(msgs[Math.floor(Math.random() * msgs.length)]);
  const level = logLevels[Math.floor(Math.random() * logLevels.length)];
  const traceId = traces.length > 0 ? traces[Math.floor(Math.random() * traces.length)].traceId : "none";
  return {
    timestamp: new Date().toISOString(),
    service: `${svcType}-${Math.floor(Math.random() * 3) + 1}`,
    level,
    message: msg,
    traceId,
  };
}

/* ── Main Page ── */

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
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logTailRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = useCallback((type: EventEntry["type"], icon: string, message: string, detail: string) => {
    eventCounter += 1;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents((prev) => [{ id: `evt-${eventCounter}`, time, type, icon, message, detail }, ...prev].slice(0, 100));
  }, []);

  /* ── Fetch Traces ── */
  const fetchTraces = useCallback(async () => {
    if (!runId) return;
    try {
      const { data } = await api.get(`/simulations/${runId}/traces`);
      if (data.traces) {
        setTraces(data.traces as TraceData[]);
      }
    } catch { /* ignore */ }
  }, [runId]);

  useEffect(() => {
    if (!isRunning || !runId) return;
    fetchTraces();
    const interval = setInterval(fetchTraces, 2000);
    return () => clearInterval(interval);
  }, [isRunning, runId, fetchTraces]);

  /* ── Structured Log Generator ── */
  useEffect(() => {
    if (!isRunning) {
      if (logTimer.current) { clearInterval(logTimer.current); logTimer.current = null; }
      return;
    }
    logTimer.current = setInterval(() => {
      if (ticks.length === 0) return;
      const entry = generateLogEntry(ticks[ticks.length - 1], traces);
      setLogs((prev) => [...prev.slice(-200), entry]);
    }, 800);
    return () => {
      if (logTimer.current) { clearInterval(logTimer.current); logTimer.current = null; }
    };
  }, [isRunning, ticks, traces]);

  /* ── Auto-scroll log tail ── */
  useEffect(() => {
    if (autoScroll && logTailRef.current) {
      logTailRef.current.scrollTop = logTailRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  /* ── WS connection ── */
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
        ws.onopen = () => addEvent("simulation", "play", "Dashboard connected", `Listening to run ${runId.slice(0, 8)}…`);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "tick") {
              useSimulationStore.getState().onTick(msg.tick);
            }
          } catch { /* skip */ }
        };
        ws.onclose = () => { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } };
        ws.onerror = () => {};
        wsRef.current = ws;
      } catch { /* ignore */ }
    };
    connect();
    return () => {
      if (pingTimer) clearInterval(pingTimer);
      if (ws) { ws.onclose = null; ws.close(); }
      wsRef.current = null;
    };
  }, [projectId, runId, addEvent]);

  /* ── Event loggers ── */
  const prevRunning = useRef(isRunning);
  const loggedViolations = useRef(new Set<string>());
  const loggedDeployments = useRef(new Set<string>());
  const prevScaleEvents = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isRunning === prevRunning.current) return;
    prevRunning.current = isRunning;
    addEvent(isRunning ? "simulation" : "simulation", isRunning ? "play" : "stop", isRunning ? "Simulation running" : "Simulation stopped", "");
  }, [isRunning, addEvent]);

  useEffect(() => {
    if (chaosEvents.length === 0) return;
    const latest = chaosEvents[chaosEvents.length - 1];
    addEvent("chaos", "skull", `Chaos: ${latest.eventType}`, `node ${latest.nodeId.slice(0, 8)}, severity ${Math.round(latest.severity * 100)}%`);
  }, [chaosEvents, addEvent]);

  useEffect(() => {
    if (violations.length === 0) return;
    const last = violations[violations.length - 1];
    const key = `${last.sourceNodeId}:${last.type}`;
    if (loggedViolations.current.has(key)) return;
    loggedViolations.current.add(key);
    addEvent("security", "shield", `Violation: ${last.type.replace(/_/g, " ")}`, last.message);
  }, [violations, addEvent]);

  useEffect(() => {
    const depKeys = Object.keys(deployStates);
    if (depKeys.length === 0) return;
    const latestDep = depKeys[depKeys.length - 1];
    if (loggedDeployments.current.has(latestDep)) return;
    loggedDeployments.current.add(latestDep);
    const state = deployStates[latestDep];
    addEvent("deployment", "rocket", `Deployment: ${state.activeGroup}`, `node ${latestDep.slice(0, 8)} → ${state.activeGroup}`);
  }, [deployStates, addEvent]);

  /* ── Auto-Scale Events from tick data ── */
  useEffect(() => {
    if (!latestTick) return;
    for (const m of latestTick.nodeMetrics) {
      const ev = m.scalingEvent;
      if (!ev) continue;
      const prev = prevScaleEvents.current[m.nodeId] ?? "";
      if (ev === prev) continue;
      prevScaleEvents.current[m.nodeId] = ev;
      const dir = ev === "scaling up" ? "⬆️" : "⬇️";
      addEvent("simulation", dir, `${dir} ${m.label} ${ev}`, `instances → ${m.instances}`);
    }
  }, [latestTick, addEvent]);

  /* ── RED Metrics: unique service labels ── */
  const serviceLabels = useMemo(() => {
    if (!latestTick) return [];
    const seen = new Set<string>();
    return latestTick.nodeMetrics.filter((m) => {
      if (seen.has(m.label)) return false;
      seen.add(m.label);
      return true;
    }).map((m) => m.label);
  }, [latestTick]);

  const redMap = useMemo(() => {
    const map: Record<string, RedDatum[]> = {};
    for (const label of serviceLabels) {
      map[label] = computeRedMetrics(ticks, label);
    }
    return map;
  }, [ticks, serviceLabels]);

  /* ── KPI values ── */
  const p99Latency = useMemo(() => {
    if (!latestTick || latestTick.nodeMetrics.length === 0) return 0;
    return Math.max(...latestTick.nodeMetrics.map((m) => m.p99LatencyMs ?? 0));
  }, [latestTick]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleScreenshot = useCallback(async () => {
    if (!dashRef.current) return;
    setScreenshotting(true);
    try {
      const canvas = await html2canvas(dashRef.current, { backgroundColor: "#09090b", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `observability-${projectId}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { /* ignore */ }
    setScreenshotting(false);
  }, [projectId]);

  /* ── Render ── */
  return (
    <div className="h-screen bg-surface-950 flex flex-col overflow-hidden" style={{ color: '#f4f4f5' }}>
      <header className="shrink-0 border-b border-surface-800 px-6 py-3 flex items-center justify-between bg-surface-950/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/project/${projectId}`)} className="text-sm hover:text-surface-200 transition-colors" style={{ color: '#a1a1aa' }} title="Back to Project">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold" style={{ color: '#f4f4f5' }}>Observability</h1>
          <span className="text-xs bg-surface-800 px-2 py-0.5 rounded" style={{ color: '#71717a' }}>{currentProject?.name ?? projectId}</span>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="text-[10px] font-mono flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live {formatTime(elapsed)}
            </span>
          )}
          {!isRunning && (
            <span className="text-[10px] flex items-center gap-1.5" style={{ color: '#71717a' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-surface-600" />
              Idle
            </span>
          )}
          <button onClick={handleScreenshot} disabled={screenshotting}
            className="px-3 py-1.5 text-[11px] font-medium bg-surface-800 hover:bg-surface-700 rounded transition-colors disabled:opacity-40 flex items-center gap-1.5" style={{ color: '#a1a1aa' }}
          >{screenshotting ? "Capturing…" : <><Camera className="h-4 w-4" /> Screenshot</>}</button>
        </div>
      </header>

      <div ref={dashRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        <div className="p-6 space-y-6">
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Total RPS" value={fmt(latestTick?.totalRPS ?? 0)} color="#60a5fa" bg="bg-blue-500/10" border="border-blue-500/20" />
            <KpiCard label="Error Rate" value={latestTick ? pct(latestTick.globalErrorRate) : "0%"}
              color={latestTick && latestTick.globalErrorRate > 0.05 ? '#ef4444' : '#f4f4f5'}
              bg={latestTick && latestTick.globalErrorRate > 0.05 ? "bg-red-500/10" : "bg-surface-800"}
              border={latestTick && latestTick.globalErrorRate > 0.05 ? "border-red-500/20" : "border-surface-700"} />
            <KpiCard label="p99 Latency" value={ms(p99Latency)}
              color={p99Latency > 500 ? '#fb923c' : '#a78bfa'}
              bg={p99Latency > 500 ? "bg-orange-500/10" : "bg-purple-500/10"}
              border={p99Latency > 500 ? "border-orange-500/20" : "border-purple-500/20"} />
            <KpiCard label="Active Requests" value={fmt(latestTick?.activeRequests ?? 0)} color="#22d3ee" bg="bg-cyan-500/10" border="border-cyan-500/20" />
          </div>

          {/* ── RED Metrics per Service ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-3" style={{ color: '#71717a' }}>
              RED Metrics <span className="normal-case" style={{ color: '#52525b' }}>(Rate · Errors · Duration p50/p90/p99)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceLabels.slice(0, 9).map((label) => (
                <RedChart key={label} data={redMap[label] || []} label={label} />
              ))}
              {serviceLabels.length === 0 && (
                <div className="col-span-full h-[80px] bg-surface-900 rounded-lg border border-surface-800 flex items-center justify-center text-[10px]" style={{ color: '#52525b' }}>
                  No service metrics yet — start a simulation
                </div>
              )}
            </div>
          </div>

          {/* ── Trace Explorer + Waterfall ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-3 flex items-center gap-2" style={{ color: '#71717a' }}>
              <Search className="h-3 w-3" /> Trace Explorer
              <span className="normal-case font-normal" style={{ color: '#52525b' }}>(last {traces.length} traces)</span>
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Trace Table */}
              <div className="bg-surface-900 rounded-lg border border-surface-800 p-3 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
                <div className="flex items-center text-[9px] font-medium px-3 pb-1.5 border-b border-surface-800" style={{ color: '#71717a' }}>
                  <span className="w-28" />
                  <span className="w-20">Service</span>
                  <span className="w-16 text-right">Duration</span>
                  <span className="w-14 text-right">Status</span>
                  <span className="flex-1 text-right">Spans</span>
                </div>
                {traces.length === 0 ? (
                  <p className="text-[10px] text-center py-8" style={{ color: '#52525b' }}>No traces yet — 1 in 100 requests are sampled</p>
                ) : (
                  traces.slice().reverse().map((t) => (
                    <TraceRow key={t.traceId} trace={t} onSelect={() => setSelectedTrace(trace => trace?.traceId === t.traceId ? null : t)} selected={selectedTrace?.traceId === t.traceId} />
                  ))
                )}
              </div>
              {/* Waterfall Chart */}
              <div className="bg-surface-900 rounded-lg border border-surface-800 p-3 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
                {selectedTrace ? (
                  <WaterfallChart trace={selectedTrace} />
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-[10px]" style={{ color: '#52525b' }}>
                    Select a trace to view waterfall chart
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Structured Log Tail & Event Log ── */}
          <div className="grid grid-cols-2 gap-6">
            {/* Structured Log Tail */}
            <div className="bg-surface-900 rounded-lg border border-surface-800 p-4 flex flex-col max-h-[320px]">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5" style={{ color: '#71717a' }}>
                  <Terminal className="h-3 w-3" /> Structured Logs
                </p>
                <label className="flex items-center gap-1.5 text-[9px]" style={{ color: '#71717a' }}>
                  <input type="checkbox" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} className="accent-blue-500 w-2.5 h-2.5" />
                  Auto-scroll
                </label>
              </div>
              <div ref={logTailRef} className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800 font-mono text-[10px] leading-relaxed space-y-0.5 min-h-0">
                {logs.length === 0 ? (
                  <p className="text-center py-8" style={{ color: '#52525b' }}>Waiting for log output…</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 px-1 py-0.5 rounded hover:bg-surface-800/50">
                      <span className="shrink-0 w-10 text-right" style={{ color: log.level === "ERROR" ? '#ef4444' : log.level === "WARN" ? '#f97316' : '#71717a' }}>{log.level}</span>
                      <span className="w-16 shrink-0" style={{ color: '#71717a' }}>{new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className="w-24 shrink-0 truncate" style={{ color: '#22d3ee' }}>{log.service}</span>
                      <span className="flex-1 truncate" style={{ color: log.level === "ERROR" ? '#ef4444' : log.level === "WARN" ? '#f97316' : '#a1a1aa' }}>{log.message}</span>
                      <span className="w-12 shrink-0 text-right truncate" style={{ color: '#52525b' }} title={log.traceId}>{log.traceId.slice(0, 6)}…</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-surface-900 rounded-lg border border-surface-800 p-4 flex flex-col max-h-[320px]">
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2 shrink-0" style={{ color: '#71717a' }}>Event Log</p>
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800 space-y-1 min-h-0">
                {events.length === 0 ? (
                  <p className="text-[10px] text-center py-4" style={{ color: '#52525b' }}>No events yet</p>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-800 transition-colors">
                      <span className="text-xs shrink-0 mt-0.5">{ev.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium truncate" style={{ color: '#f4f4f5' }}>{ev.message}</span>
                          <span className="text-[8px] shrink-0 ml-auto" style={{ color: '#52525b' }}>{ev.time}</span>
                        </div>
                        {ev.detail && <p className="text-[8px] truncate" style={{ color: '#71717a' }}>{ev.detail}</p>}
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
      <p className="text-[9px] uppercase tracking-wider font-medium mb-1" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
