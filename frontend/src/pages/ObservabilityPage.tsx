import { useState, useEffect, useCallback, useMemo, useRef, memo, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSimulationStore, type TickData } from "../store/simulationStore";
import { useChaosStore } from "../store/chaosStore";
import { useDeployStore } from "../store/deploymentStore";
import { useSecurityStore } from "../store/securityStore";
import { useProjectStore } from "../store/projectStore";
import html2canvas from "html2canvas";
import { Camera, ArrowLeft, Search, Terminal, CheckCircle, Clock, XCircle, ArrowUp, ArrowDown, Skull, Shield, Rocket, Play, Square } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "../utils/api";
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, List, ListItem, ListItemText, Button, Checkbox } from "@mui/material";

const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api")
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#27272a" };
const CHART_TICK = { fontSize: 9, fill: "#71717a" };
const TOOLTIP_STYLE = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11, maxHeight: 200, overflowY: "auto" as const };
const TOOLTIP_LABEL = { color: "#e4e4e7" };

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

interface RedDatum { tick: number; rate: number; errors: number; p50: number; p90: number; p99: number; }

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
    return { tick: t.tickNumber, rate: Math.round(agg.rate), errors: Math.round(agg.errors), p50: Math.round(agg.latency * 1.2), p90: Math.round(agg.p99 * 0.7), p99: Math.round(agg.p99) };
  });
}

const RedChart = memo(function RedChart({ data, label }: { data: RedDatum[]; label: string }) {
  if (data.length <= 1) {
    return <Box sx={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}><Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>Waiting for data…</Typography></Box>;
  }
  return (
    <Box sx={{ bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", p: 1.5 }}>
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>{label}</Typography>
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
    </Box>
  );
});

interface TraceSpanEvent {
  timestamp: string;
  name: string;
  attributes?: Record<string, any>;
}

interface TraceSpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, any>;
}

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
  events?: TraceSpanEvent[];
  attributes?: Record<string, any>;
  links?: TraceSpanLink[];
}
interface TraceData { traceId: string; spans: SpanData[]; rootNodeId: string; rootNodeLabel: string; startTime: string; endTime: string; totalDurationMs: number; status: "OK" | "ERROR"; hasError: boolean; }

const TraceRow = memo(function TraceRow({ trace, onSelect, selected }: { trace: TraceData; onSelect: () => void; selected: boolean }) {
  return (
    <TableRow hover onClick={onSelect} selected={selected} sx={{ cursor: "pointer", "&:hover": { bgcolor: "#27272a" }, "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.2)" } }}>
      <TableCell sx={{ py: 0.75, px: 1, border: "none" }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: trace.status === "ERROR" ? "#ef4444" : "#22c55e" }} />
      </TableCell>
      <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", fontFamily: "monospace", color: "#a1a1aa" }}>{trace.traceId.slice(0, 8)}…</TableCell>
      <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", color: "#71717a" }}>{trace.rootNodeLabel}</TableCell>
      <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", fontFamily: "monospace", color: "#a1a1aa", textAlign: "right" }}>{ms(trace.totalDurationMs)}</TableCell>
      <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", textAlign: "right", color: trace.status === "ERROR" ? "#ef4444" : "#22c55e" }}>{trace.status}</TableCell>
      <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.6rem", color: "#52525b", textAlign: "right" }}>{trace.spans.length} spans</TableCell>
    </TableRow>
  );
});

function WaterfallChart({ trace, onSpanLinkClick }: { trace: TraceData; onSpanLinkClick: (traceId: string) => void }) {
  const maxDur = Math.max(...trace.spans.map((s) => s.durationMs), 1);
  const parseTime = (t: string) => new Date(t).getTime();
  const traceStart = Math.min(...trace.spans.map((s) => parseTime(s.entryTime)).filter((t) => !isNaN(t)));
  const traceEnd = Math.max(...trace.spans.map((s) => parseTime(s.exitTime)).filter((t) => !isNaN(t)));
  const totalMs = traceEnd - traceStart || maxDur;
  const [detailSpan, setDetailSpan] = useState<SpanData | null>(null);
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>
        Trace <Typography variant="caption" component="span" sx={{ fontFamily: "monospace", color: "#f4f4f5", fontSize: "0.6rem" }}>{trace.traceId.slice(0, 12)}…</Typography>
        {" · "}{trace.spans.length} spans · {ms(trace.totalDurationMs)} total
        {trace.hasError && <Box component="span" sx={{ ml: 0.5, color: "#ef4444", display: "inline-flex", alignItems: "center", gap: 0.25, verticalAlign: "middle", fontSize: "0.6rem" }}><XCircle size={12} /> Has Errors</Box>}
      </Typography>
      <Box sx={{ border: 1, borderColor: "#27272a", borderRadius: 1, overflow: "hidden" }}>
        <Box sx={{ display: "flex", bgcolor: "#27272a", px: 1.5, py: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a" }}>
          <Box sx={{ width: 160, flexShrink: 0 }}>Service</Box>
          <Box sx={{ width: 56, flexShrink: 0, textAlign: "right" }}>Duration</Box>
          <Box sx={{ flex: 1, ml: 1, position: "relative", height: 16 }}>
            <Typography variant="caption" component="span" sx={{ position: "absolute", left: 0, top: 0, fontSize: "0.55rem", color: "#71717a" }}>0</Typography>
            <Typography variant="caption" component="span" sx={{ position: "absolute", right: 0, top: 0, fontSize: "0.55rem", color: "#71717a" }}>{ms(maxDur)}</Typography>
          </Box>
        </Box>
        {trace.spans.map((span, i) => {
          const pct = maxDur > 0 ? (span.durationMs / totalMs) * 100 : 0;
          const isError = span.status === "ERROR";
          const isCache = span.spanType === "CACHE_HIT";
          const isAsync = span.spanType === "ASYNC_WAIT";
          const spanStart = parseTime(span.entryTime);
          const offsetPct = !isNaN(spanStart) && totalMs > 0 ? ((spanStart - traceStart) / totalMs) * 100 : 0;
          let barColor = "#3b82f6";
          if (isError) barColor = "#ef4444";
          else if (isCache) barColor = "#10b981";
          else if (isAsync) barColor = "#f59e0b";
          const events = span.events ?? [];
          const hasException = events.some((e) => e.name === "exception");
          const hasChaosFailure = events.some((e) => e.name?.startsWith("chaos."));
          return (
            <Box key={span.spanId} sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.75, bgcolor: i % 2 === 0 ? "#18181b" : "#09090b", fontSize: "0.65rem" }}>
              <Box
                sx={{ width: 160, flexShrink: 0, display: "flex", alignItems: "center", gap: 0.25, color: "#f4f4f5", cursor: "pointer" }}
                onClick={() => setDetailSpan(detailSpan?.spanId === span.spanId ? null : span)}
              >
                {(hasException || hasChaosFailure) && <XCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                {isCache && !hasException && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                {isAsync && !hasException && <Clock size={12} style={{ color: "#f97316", flexShrink: 0 }} />}
                {isError && !hasException && <XCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                {span.nodeLabel}
                <Typography variant="caption" component="span" sx={{ fontSize: "0.55rem", ml: 0.25, color: "#71717a" }}>{span.nodeType}</Typography>
              </Box>
              <Box sx={{ width: 56, flexShrink: 0, textAlign: "right", fontFamily: "monospace", color: "#a1a1aa", fontSize: "0.65rem" }}>{ms(span.durationMs)}</Box>
              <Box sx={{ flex: 1, ml: 1, position: "relative", height: 16 }}>
                <Box sx={{ position: "absolute", top: 2, height: 12, borderRadius: "999px", opacity: 0.8, bgcolor: barColor, left: `${Math.max(0, offsetPct)}%`, width: `${Math.max(pct, 2)}%` }} />
                {/* Span event markers - red diamonds */}
                {events.map((ev, ei) => {
                  const evTime = parseTime(ev.timestamp);
                  if (isNaN(evTime)) return null;
                  const evPct = totalMs > 0 ? ((evTime - traceStart) / totalMs) * 100 : 0;
                  const isException = ev.name === "exception";
                  return (
                    <Box
                      key={ei}
                      title={ev.name}
                      sx={{
                        position: "absolute",
                        top: 1,
                        left: `${Math.max(0, Math.min(100, evPct))}%`,
                        width: 0,
                        height: 0,
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderTop: "6px solid",
                        borderTopColor: isException ? "#EF4444" : "#F59E0B",
                        transform: "translateX(-50%)",
                        opacity: 0.9,
                        zIndex: 2,
                        ...(isException ? {
                          animation: "v-pulse 1s ease-in-out infinite",
                          "@keyframes v-pulse": {
                            "0%, 100%": { opacity: 0.9 },
                            "50%": { opacity: 0.3 },
                          },
                        } : {}),
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
      {/* Span detail panel: Attributes + Links */}
      {detailSpan && (
        <Box sx={{ mt: 1, border: 1, borderColor: "#27272a", borderRadius: 1, bgcolor: "#18181b", p: 1.5 }}>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>
            {detailSpan.nodeLabel} — {detailSpan.spanId.slice(0, 8)}
          </Typography>
          {detailSpan.attributes && Object.keys(detailSpan.attributes).length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontSize: "0.55rem", fontWeight: 500, color: "#71717a", display: "block", mb: 0.5 }}>Attributes</Typography>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.55rem" }}>
                <Box component="tbody">
                  {Object.entries(detailSpan.attributes).map(([k, v]) => (
                    <Box component="tr" key={k} sx={{ borderBottom: 1, borderColor: "#27272a" }}>
                      <Box component="td" sx={{ py: 0.25, pr: 1, fontWeight: 600, color: "#a1a1aa", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</Box>
                      <Box component="td" sx={{ py: 0.25, fontFamily: "monospace", color: "#22d3ee", wordBreak: "break-all" }}>{String(v)}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
          {detailSpan.links && detailSpan.links.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontSize: "0.55rem", fontWeight: 500, color: "#71717a", display: "block", mb: 0.5 }}>Span Links</Typography>
              {detailSpan.links.map((lnk, li) => (
                <Box key={li} sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.55rem", fontFamily: "monospace", color: "#52525b" }}>
                    {lnk.traceId.slice(0, 8)}…/{lnk.spanId.slice(0, 8)}
                  </Typography>
                  <Typography
                    variant="caption"
                    onClick={() => onSpanLinkClick(lnk.traceId)}
                    sx={{ fontSize: "0.55rem", color: "#14B8A6", cursor: "pointer", textDecoration: "underline", "&:hover": { color: "#2DD4BF" } }}
                  >
                    View Trace &rarr;
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

interface LogEntry { timestamp: string; service: string; level: "INFO" | "WARN" | "ERROR"; message: string; traceId: string; }

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
  Redis: ["Key evicted by LRU policy", "Cluster slot migration complete", "Replication backlog overflow", "OMEM watchdog triggered", "Pipeline execution failed at command #{n}"],
  LoadBalancer: ["Backend {svc} marked unhealthy", "Connection draining for target {id}", "SSL certificate rotation in progress", "Sticky session affinity lost", "Upstream connect error ({code})"],
  MessageQueue: ["Consumer group rebalancing", "Dead-letter queue depth: {n}", "Message retention policy exceeded", "Partition leader re-elected", "Batch acknowledgement timed out"],
};

const logLevels: ("INFO" | "WARN" | "ERROR")[] = ["INFO", "INFO", "INFO", "WARN", "ERROR"];

function fillTemplate(msg: string): string {
  return msg.replace(/\{n\}/g, String(Math.floor(Math.random() * 9000) + 100))
    .replace(/\{key\}/g, ["user:1234", "session:abc", "cache:doc_v2", "rate:limit:ip"][Math.floor(Math.random() * 4)])
    .replace(/\{id\}/g, String(Math.floor(Math.random() * 9999) + 1))
    .replace(/\{svc\}/g, ["payment", "inventory", "notification", "auth"][Math.floor(Math.random() * 4)])
    .replace(/\{topic\}/g, ["orders.created", "payments.confirmed", "users.updated"][Math.floor(Math.random() * 3)])
    .replace(/\{path\}/g, ["users", "orders", "payments", "products"][Math.floor(Math.random() * 4)])
    .replace(/\{ip\}/g, `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`)
    .replace(/\{table\}/g, ["users", "orders", "products", "inventory"][Math.floor(Math.random() * 4)])
    .replace(/\{code\}/g, String(Math.floor(Math.random() * 500) + 100));
}

function generateLogEntry(_tick: TickData, traces: TraceData[]): LogEntry {
  const svcTypes = Object.keys(logMessages);
  const svcType = svcTypes[Math.floor(Math.random() * svcTypes.length)];
  const msgs = logMessages[svcType] || logMessages.AppServer;
  const msg = fillTemplate(msgs[Math.floor(Math.random() * msgs.length)]);
  const level = logLevels[Math.floor(Math.random() * logLevels.length)];
  const traceId = traces.length > 0 ? traces[Math.floor(Math.random() * traces.length)].traceId : "none";
  return { timestamp: new Date().toISOString(), service: `${svcType}-${Math.floor(Math.random() * 3) + 1}`, level, message: msg, traceId };
}

interface EventEntry { id: string; time: string; type: "simulation" | "chaos" | "deployment" | "security"; icon: ReactNode; message: string; detail: string; }

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
  const currentProject = useProjectStore((s) => s.currentProject);

  const [events, setEvents] = useState<EventEntry[]>([]);
  const [screenshotting, setScreenshotting] = useState(false);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logTailRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = useCallback((type: EventEntry["type"], icon: ReactNode, message: string, detail: string) => {
    eventCounter += 1;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents((prev) => [{ id: `evt-${eventCounter}`, time, type, icon, message, detail }, ...prev].slice(0, 100));
  }, []);

  const fetchTraces = useCallback(async () => {
    if (!runId) return;
    try {
      const { data } = await api.get(`/simulations/${runId}/traces`);
      // Parse OTel ResourceSpans envelope
      if (data.resourceSpans) {
        const allSpans: SpanData[] = [];
        for (const rs of data.resourceSpans) {
          for (const ss of rs.scopeSpans ?? []) {
            for (const span of ss.spans ?? []) {
              const sd: SpanData = {
                spanId: span.spanId ?? span.span_id ?? "",
                traceId: span.traceId ?? span.trace_id ?? "",
                nodeId: span.nodeId ?? span.node_id ?? "",
                nodeLabel: span.nodeLabel ?? span.node_label ?? "",
                nodeType: span.nodeType ?? span.node_type ?? "",
                entryTime: span.entryTime ?? span.startTime ?? span.start_time ?? "",
                exitTime: span.exitTime ?? span.endTime ?? span.end_time ?? "",
                durationMs: span.durationMs ?? span.duration_ms ?? 0,
                status: span.status === "ERROR" || span.status_code === 2 ? "ERROR" : "OK",
                spanType: span.spanType ?? "",
                events: (span.events ?? []).map((ev: any) => ({
                  timestamp: ev.timestamp ?? ev.time ?? ev.time_unix_nano ?? "",
                  name: ev.name ?? "",
                  attributes: ev.attributes ?? ev.attr ?? {},
                })),
                attributes: span.attributes ?? span.attr ?? {},
                links: (span.links ?? []).map((lnk: any) => ({
                  traceId: lnk.traceId ?? lnk.trace_id ?? "",
                  spanId: lnk.spanId ?? lnk.span_id ?? "",
                  attributes: lnk.attributes ?? lnk.attr ?? {},
                })),
              };
              allSpans.push(sd);
            }
          }
        }
        // Group by traceId
        const grouped = new Map<string, SpanData[]>();
        for (const s of allSpans) {
          if (!grouped.has(s.traceId)) grouped.set(s.traceId, []);
          grouped.get(s.traceId)!.push(s);
        }
        const tracesArr: TraceData[] = [];
        for (const [traceId, spans] of grouped) {
          const startMs = Math.min(...spans.map((s) => new Date(s.entryTime).getTime()).filter((t) => !isNaN(t)));
          const endMs = Math.max(...spans.map((s) => new Date(s.exitTime).getTime()).filter((t) => !isNaN(t)));
          const totalDurationMs = endMs - startMs || Math.max(...spans.map((s) => s.durationMs));
          const root = spans.find((s) => s.nodeId === spans[0]?.nodeId) ?? spans[0];
          tracesArr.push({
            traceId,
            spans,
            rootNodeId: root.nodeId,
            rootNodeLabel: root.nodeLabel,
            startTime: root.entryTime,
            endTime: root.exitTime,
            totalDurationMs,
            status: spans.some((s) => s.status === "ERROR") ? "ERROR" : "OK",
            hasError: spans.some((s) => s.status === "ERROR"),
          });
        }
        setTraces(tracesArr);
      } else if (data.traces) {
        // Fallback to flat format
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
    return () => { if (logTimer.current) { clearInterval(logTimer.current); logTimer.current = null; } };
  }, [isRunning, ticks, traces]);

  useEffect(() => {
    if (autoScroll && logTailRef.current) logTailRef.current.scrollTop = logTailRef.current.scrollHeight;
  }, [logs, autoScroll]);

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
        ws.onopen = () => addEvent("simulation", <Play size={12} />, "Dashboard connected", `Listening to run ${runId.slice(0, 8)}…`);
        ws.onmessage = (event) => { try { const msg = JSON.parse(event.data); if (msg.type === "tick") useSimulationStore.getState().onTick(msg.tick); } catch { /* skip */ } };
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

  const handleSpanLinkClick = useCallback(async (linkTraceId: string) => {
    const found = traces.find((t) => t.traceId === linkTraceId);
    if (found) { setSelectedTrace(found); return; }
    try {
      const { data } = await api.get(`/simulations/${runId}/traces`);
      if (data.traces) setTraces(data.traces as TraceData[]);
      if (data.resourceSpans) {
        // Re-parse the envelope and look for the linked trace
        const refresh = await api.get(`/simulations/${runId}/traces`);
        const refreshData = refresh.data;
        if (refreshData.resourceSpans) {
          const linkedSpans: SpanData[] = [];
          for (const rs of refreshData.resourceSpans) {
            for (const ss of rs.scopeSpans ?? []) {
              for (const span of ss.spans ?? []) {
                if ((span.traceId ?? span.trace_id ?? "") === linkTraceId) {
                  linkedSpans.push({
                    spanId: span.spanId ?? span.span_id ?? "",
                    traceId: span.traceId ?? span.trace_id ?? "",
                    nodeId: span.nodeId ?? span.node_id ?? "",
                    nodeLabel: span.nodeLabel ?? span.node_label ?? "",
                    nodeType: span.nodeType ?? span.node_type ?? "",
                    entryTime: span.entryTime ?? span.startTime ?? span.start_time ?? "",
                    exitTime: span.exitTime ?? span.endTime ?? span.end_time ?? "",
                    durationMs: span.durationMs ?? span.duration_ms ?? 0,
                    status: span.status === "ERROR" || span.status_code === 2 ? "ERROR" : "OK",
                    spanType: span.spanType ?? "",
                    events: (span.events ?? []).map((ev: any) => ({ timestamp: ev.timestamp ?? ev.time ?? "", name: ev.name ?? "", attributes: ev.attributes ?? {} })),
                    attributes: span.attributes ?? {},
                    links: (span.links ?? []).map((lnk: any) => ({ traceId: lnk.traceId ?? lnk.trace_id ?? "", spanId: lnk.spanId ?? lnk.span_id ?? "", attributes: lnk.attributes ?? {} })),
                  });
                }
              }
            }
          }
          if (linkedSpans.length > 0) {
            const startMs = Math.min(...linkedSpans.map((s) => new Date(s.entryTime).getTime()).filter((t) => !isNaN(t)));
            const endMs = Math.max(...linkedSpans.map((s) => new Date(s.exitTime).getTime()).filter((t) => !isNaN(t)));
            const root = linkedSpans[0];
            setSelectedTrace({
              traceId: linkTraceId,
              spans: linkedSpans,
              rootNodeId: root.nodeId,
              rootNodeLabel: root.nodeLabel,
              startTime: root.entryTime,
              endTime: root.exitTime,
              totalDurationMs: endMs - startMs || Math.max(...linkedSpans.map((s) => s.durationMs)),
              status: linkedSpans.some((s) => s.status === "ERROR") ? "ERROR" : "OK",
              hasError: linkedSpans.some((s) => s.status === "ERROR"),
            });
          }
        }
      }
    } catch { /* ignore */ }
  }, [runId]);

  const prevRunning = useRef(isRunning);
  const loggedViolations = useRef(new Set<string>());
  const loggedDeployments = useRef(new Set<string>());
  const prevScaleEvents = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isRunning === prevRunning.current) return;
    prevRunning.current = isRunning;
    addEvent("simulation", isRunning ? <Play size={12} /> : <Square size={12} />, isRunning ? "Simulation running" : "Simulation stopped", "");
  }, [isRunning, addEvent]);

  useEffect(() => {
    if (chaosEvents.length === 0) return;
    const latest = chaosEvents[chaosEvents.length - 1];
    addEvent("chaos", <Skull size={12} />, `Chaos: ${latest.eventType}`, `node ${latest.nodeId.slice(0, 8)}, severity ${Math.round(latest.severity * 100)}%`);
  }, [chaosEvents, addEvent]);

  useEffect(() => {
    if (violations.length === 0) return;
    const last = violations[violations.length - 1];
    const key = `${last.sourceNodeId}:${last.type}`;
    if (loggedViolations.current.has(key)) return;
    loggedViolations.current.add(key);
    addEvent("security", <Shield size={12} />, `Violation: ${last.type.replace(/_/g, " ")}`, last.message);
  }, [violations, addEvent]);

  useEffect(() => {
    const depKeys = Object.keys(deployStates);
    if (depKeys.length === 0) return;
    const latestDep = depKeys[depKeys.length - 1];
    if (loggedDeployments.current.has(latestDep)) return;
    loggedDeployments.current.add(latestDep);
    const state = deployStates[latestDep];
    addEvent("deployment", <Rocket size={12} />, `Deployment: ${state.activeGroup}`, `node ${latestDep.slice(0, 8)} → ${state.activeGroup}`);
  }, [deployStates, addEvent]);

  useEffect(() => {
    if (!latestTick) return;
    for (const m of latestTick.nodeMetrics) {
      const ev = m.scalingEvent;
      if (!ev) continue;
      const prev = prevScaleEvents.current[m.nodeId] ?? "";
      if (ev === prev) continue;
      prevScaleEvents.current[m.nodeId] = ev;
      const dir = ev === "scaling up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
      addEvent("simulation", dir, `${m.label} ${ev}`, `instances → ${m.instances}`);
    }
  }, [latestTick, addEvent]);

  const serviceLabels = useMemo(() => {
    if (!latestTick) return [];
    const seen = new Set<string>();
    return latestTick.nodeMetrics.filter((m) => { if (seen.has(m.label)) return false; seen.add(m.label); return true; }).map((m) => m.label);
  }, [latestTick]);

  const redMap = useMemo(() => {
    const map: Record<string, RedDatum[]> = {};
    for (const label of serviceLabels) map[label] = computeRedMetrics(ticks, label);
    return map;
  }, [ticks, serviceLabels]);

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

  return (
    <Box sx={{ height: "100vh", bgcolor: "#09090b", display: "flex", flexDirection: "column", overflow: "hidden", color: "#f4f4f5" }}>
      <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "#27272a", px: 3, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "rgba(9,9,11,0.9)", zIndex: 10 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button onClick={() => navigate(`/project/${projectId}`)} sx={{ minWidth: 0, p: 0.5, color: "#a1a1aa", fontSize: "0.8rem" }}><ArrowLeft size={16} /></Button>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#f4f4f5", fontSize: "1.1rem" }}>Observability</Typography>
          <Typography variant="caption" sx={{ bgcolor: "#27272a", px: 1, py: 0.25, borderRadius: 0.5, color: "#71717a", fontSize: "0.65rem" }}>{currentProject?.name ?? projectId}</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {isRunning && (
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 0.75, color: "#22c55e" }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
              Live {formatTime(elapsed)}
            </Typography>
          )}
          {!isRunning && (
            <Typography variant="caption" sx={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: 0.75, color: "#71717a" }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#52525b" }} />
              Idle
            </Typography>
          )}
          <Button onClick={handleScreenshot} disabled={screenshotting} size="small" sx={{ color: "#a1a1aa", bgcolor: "#27272a", fontSize: "0.65rem", "&:hover": { bgcolor: "#3f3f46" } }}>
            {screenshotting ? "Capturing…" : <><Camera size={16} style={{ marginRight: 4 }} /> Screenshot</>}
          </Button>
        </Box>
      </Box>

      <Box ref={dashRef} sx={{ flex: 1, overflowY: "auto" }}>
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* KPI Cards */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <KpiCard label="Total RPS" value={fmt(latestTick?.totalRPS ?? 0)} color="#60a5fa" bgcolor="rgba(59,130,246,0.1)" bordercolor="rgba(59,130,246,0.2)" />
            <KpiCard label="Error Rate" value={latestTick ? pct(latestTick.globalErrorRate) : "0%"}
              color={latestTick && latestTick.globalErrorRate > 0.05 ? '#ef4444' : '#f4f4f5'}
              bgcolor={latestTick && latestTick.globalErrorRate > 0.05 ? 'rgba(239,68,68,0.1)' : '#27272a'}
              bordercolor={latestTick && latestTick.globalErrorRate > 0.05 ? 'rgba(239,68,68,0.2)' : '#3f3f46'} />
            <KpiCard label="p99 Latency" value={ms(p99Latency)}
              color={p99Latency > 500 ? '#fb923c' : '#a78bfa'}
              bgcolor={p99Latency > 500 ? 'rgba(251,146,60,0.1)' : 'rgba(167,139,250,0.1)'}
              bordercolor={p99Latency > 500 ? 'rgba(251,146,60,0.2)' : 'rgba(167,139,250,0.2)'} />
            <KpiCard label="Active Requests" value={fmt(latestTick?.activeRequests ?? 0)} color="#22d3ee" bgcolor="rgba(34,211,238,0.1)" bordercolor="rgba(34,211,238,0.2)" />
          </Box>

          {/* RED Metrics per Service */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a", display: "block", mb: 1.5 }}>
              RED Metrics <Typography variant="caption" component="span" sx={{ textTransform: "none", color: "#52525b", fontSize: "0.6rem" }}>(Rate · Errors · Duration p50/p90/p99)</Typography>
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 1.5 }}>
              {serviceLabels.slice(0, 9).map((label) => (
                <RedChart key={label} data={redMap[label] || []} label={label} />
              ))}
              {serviceLabels.length === 0 && (
                <Box sx={{ gridColumn: "1 / -1", height: 80, bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>No service metrics yet — start a simulation</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Trace Explorer + Waterfall */}
          <Box>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a", display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <Search size={12} /> Trace Explorer
              <Typography variant="caption" component="span" sx={{ textTransform: "none", fontWeight: 400, color: "#52525b", fontSize: "0.6rem" }}>(last {traces.length} traces)</Typography>
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {/* Trace Table */}
              <Box sx={{ bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", maxHeight: 320, overflowY: "auto" }}>
                <Table size="small" sx={{ "& .MuiTableCell-root": { borderColor: "#27272a" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.75, px: 1, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", width: 16 }} />
                      <TableCell sx={{ py: 0.75, px: 0.5, fontSize: "0.55rem", fontWeight: 500, color: "#71717a" }}>Trace</TableCell>
                      <TableCell sx={{ py: 0.75, px: 0.5, fontSize: "0.55rem", fontWeight: 500, color: "#71717a" }}>Service</TableCell>
                      <TableCell sx={{ py: 0.75, px: 0.5, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", textAlign: "right" }}>Duration</TableCell>
                      <TableCell sx={{ py: 0.75, px: 0.5, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", textAlign: "right" }}>Status</TableCell>
                      <TableCell sx={{ py: 0.75, px: 0.5, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", textAlign: "right" }}>Spans</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traces.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: "center", py: 4, fontSize: "0.6rem", color: "#52525b", border: "none" }}>No traces yet — 1 in 100 requests are sampled</TableCell>
                      </TableRow>
                    ) : (
                      traces.slice().reverse().map((t) => (
                        <TraceRow key={t.traceId} trace={t} onSelect={() => setSelectedTrace(trace => trace?.traceId === t.traceId ? null : t)} selected={selectedTrace?.traceId === t.traceId} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
              {/* Waterfall Chart */}
              <Box sx={{ bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", p: 1.5, maxHeight: 320, overflowY: "auto" }}>
                {selectedTrace ? (
                  <WaterfallChart trace={selectedTrace} onSpanLinkClick={handleSpanLinkClick} />
                ) : (
                  <Box sx={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>Select a trace to view waterfall chart</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Structured Log Tail & Event Log */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            {/* Structured Log Tail */}
            <Box sx={{ bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", p: 2, display: "flex", flexDirection: "column", maxHeight: 320 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexShrink: 0 }}>
                <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a", display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Terminal size={12} /> Structured Logs
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Checkbox size="small" checked={autoScroll} onChange={() => setAutoScroll(!autoScroll)} sx={{ color: "#71717a", "&.Mui-checked": { color: "#3b82f6" }, p: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#71717a" }}>Auto-scroll</Typography>
                </Box>
              </Box>
              <Box ref={logTailRef} sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {logs.length === 0 ? (
                  <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 4, color: "#52525b", fontSize: "0.6rem" }}>Waiting for log output…</Typography>
                ) : (
                  <List dense disablePadding>
                    {logs.map((log, i) => (
                      <ListItem key={i} disablePadding sx={{ px: 0.5, py: 0.25, borderRadius: 0.5, "&:hover": { bgcolor: "rgba(39,39,42,0.5)" } }}>
                        <Typography variant="caption" sx={{ width: 40, flexShrink: 0, textAlign: "right", fontFamily: "monospace", fontSize: "0.55rem", color: log.level === "ERROR" ? "#ef4444" : log.level === "WARN" ? "#f97316" : "#71717a" }}>
                          {log.level}
                        </Typography>
                        <Typography variant="caption" sx={{ width: 64, flexShrink: 0, fontFamily: "monospace", fontSize: "0.55rem", color: "#71717a", ml: 0.5 }}>
                          {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </Typography>
                        <Typography variant="caption" sx={{ width: 96, flexShrink: 0, fontFamily: "monospace", fontSize: "0.55rem", color: "#22d3ee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.service}
                        </Typography>
                        <Typography variant="caption" sx={{ flex: 1, fontFamily: "monospace", fontSize: "0.55rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: log.level === "ERROR" ? "#ef4444" : log.level === "WARN" ? "#f97316" : "#a1a1aa" }}>
                          {log.message}
                        </Typography>
                        <Typography variant="caption" sx={{ width: 48, flexShrink: 0, textAlign: "right", fontFamily: "monospace", fontSize: "0.5rem", color: "#52525b" }} title={log.traceId}>
                          {log.traceId.slice(0, 6)}…
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>

            {/* Event Log */}
            <Box sx={{ bgcolor: "#18181b", borderRadius: 1, border: 1, borderColor: "#27272a", p: 2, display: "flex", flexDirection: "column", maxHeight: 320 }}>
              <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a", display: "block", mb: 1, flexShrink: 0 }}>
                Event Log
              </Typography>
              <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {events.length === 0 ? (
                  <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 2, color: "#52525b", fontSize: "0.6rem" }}>No events yet</Typography>
                ) : (
                  <List dense disablePadding>
                    {events.map((ev) => (
                      <ListItem key={ev.id} disablePadding sx={{ px: 1, py: 0.5, borderRadius: 0.5, "&:hover": { bgcolor: "#27272a" } }}>
                        <Box sx={{ mr: 0.5, fontSize: "0.75rem", mt: 0.25, flexShrink: 0, display: "flex", alignItems: "center" }}>{ev.icon}</Box>
                        <ListItemText
                          primary={ev.message}
                          secondary={ev.detail}
                          slotProps={{
                            primary: { sx: { fontSize: "0.55rem", fontWeight: 500, color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                            secondary: { sx: { fontSize: "0.5rem", color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "#52525b", ml: "auto", flexShrink: 0 }}>{ev.time}</Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function KpiCard({ label, value, color, bgcolor, bordercolor }: { label: string; value: string; color: string; bgcolor: string; bordercolor: string }) {
  return (
    <Box sx={{ bgcolor, border: 1, borderColor: bordercolor, borderRadius: 1, p: 2 }}>
      <Typography variant="caption" sx={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#71717a", display: "block", mb: 0.5 }}>{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "monospace", fontVariantNumeric: "tabular-nums", color }}>{value}</Typography>
    </Box>
  );
}
