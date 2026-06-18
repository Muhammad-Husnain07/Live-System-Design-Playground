import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useSimulationStore } from "../../store/simulationStore";
import { useObservabilityStore } from "../../store/observabilityStore";
import TracesPanel from "./TracesPanel";
import LogsPanel from "./LogsPanel";
import SLOPanel from "./SLOPanel";
import IncidentTimeline from "./IncidentTimeline";
import { Box, Typography, Paper } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";

const CHART_TICK = { fontSize: 9, fill: spatialTokens.text.secondary };
const CHART_AXIS_LINE = { strokeDasharray: "3 3", stroke: spatialTokens.border.default };
const TOOLTIP = { contentStyle: { background: spatialTokens.bg.panel, border: `1px solid ${spatialTokens.border.default}`, borderRadius: 4, fontSize: 11 } };

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

export default function BottomDrawer() {
  const [activeTab, setActiveTab] = useState(0);
  const [drawerHeight, setDrawerHeight] = useState<number>(() => Math.round(window.innerHeight * 0.2));
  const resizing = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const activeBottomTab = useObservabilityStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useObservabilityStore((s) => s.setActiveBottomTab);
  const traces = useObservabilityStore((s) => s.traces);
  const logTotal = useObservabilityStore((s) => s.logTotal);

  useEffect(() => {
    if (activeBottomTab === "traces" && activeTab !== 2) setActiveTab(2);
    else if (activeBottomTab === "logs" && activeTab !== 1) setActiveTab(1);
  }, [activeBottomTab, activeTab]);

  const ticks = useSimulationStore((s) => s.ticks);
  const latestTick = useSimulationStore((s) => s.latestTick);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const elapsed = useSimulationStore((s) => s.elapsed);

  const p99Latency = useMemo(() => {
    if (!latestTick || latestTick.nodeMetrics.length === 0) return 0;
    return Math.max(...latestTick.nodeMetrics.map((m) => m.p99LatencyMs ?? 0));
  }, [latestTick]);

  const totalRPS = latestTick?.totalRPS ?? 0;
  const errorRate = latestTick?.globalErrorRate ?? 0;

  const chartData = useMemo(() => {
    return ticks.slice(-60).map((t) => ({ tick: t.tickNumber, rps: Math.round(t.totalRPS), errors: Math.round(t.globalErrorRate * 100) }));
  }, [ticks]);

  const nodeGridData = useMemo(() => {
    if (!latestTick) return [];
    const seen = new Set<string>();
    return latestTick.nodeMetrics.filter((m) => { if (seen.has(m.label)) return false; seen.add(m.label); return true; });
  }, [latestTick]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    resizing.current = true;
    startY.current = e.clientY;
    startH.current = drawerHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [drawerHeight]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const vh = window.innerHeight;
    const delta = startY.current - e.clientY;
    const newH = Math.max(vh * 0.1, Math.min(vh * 0.4, startH.current + delta));
    setDrawerHeight(newH);
  }, []);

  const handlePointerUp = useCallback(() => {
    resizing.current = false;
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: drawerHeight, bgcolor: "background.paper", minHeight: 0, flexShrink: 0, position: "relative" }}>
      {/* Drag Handle */}
      <Box
        onPointerDown={handlePointerDown}
        sx={{ height: 4, cursor: "row-resize", flexShrink: 0, transition: "background-color 0.15s", "&:hover": { bgcolor: "primary.main" }, touchAction: "none" }}
      />

      {/* KPI Bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 0.5, flexShrink: 0 }}>
        <KpiPill label="RPS" value={fmt(totalRPS)} color="#60a5fa" />
        <KpiPill label="Errors" value={pct(errorRate)} color={errorRate > 0.05 ? "#ef4444" : "#a1a1aa"} />
        <KpiPill label="p99" value={ms(p99Latency)} color={p99Latency > 500 ? "#fb923c" : "#a78bfa"} />
        {isRunning && (
          <Typography variant="caption" sx={{ fontSize: "0.6rem", fontFamily: spatialTokens.font.mono, color: "#22c55e", display: "flex", alignItems: "center", gap: 0.5, ml: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
            {formatElapsed(elapsed)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      {/* IDE-style tabs */}
      <Box sx={{ display: "flex", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <TabButton label="Metrics" active={activeTab === 0} onClick={() => setActiveTab(0)} />
        <TabButton label="Logs" active={activeTab === 1} onClick={() => { setActiveTab(1); setActiveBottomTab("logs"); }} count={logTotal} />
        <TabButton label="Traces" active={activeTab === 2} onClick={() => { setActiveTab(2); setActiveBottomTab("traces"); }} count={traces.length} />
        <TabButton label="SLO" active={activeTab === 3} onClick={() => setActiveTab(3)} />
        <TabButton label="Incidents" active={activeTab === 4} onClick={() => setActiveTab(4)} />
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {activeTab === 0 && (
          <Box sx={{ display: "flex", height: "100%", gap: 2, p: 2, minHeight: 0 }}>
            {/* Chart */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider", p: 2, minHeight: 0 }}>
              <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "text.secondary", mb: 1 }}>Traffic Over Time</Typography>
              {chartData.length <= 1 ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="caption" sx={{ color: "text.placeholder", fontSize: "0.6rem" }}>Waiting for data…</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <XAxis dataKey="tick" tick={CHART_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
                      <YAxis yAxisId="rps" tick={CHART_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={36} />
                      <YAxis yAxisId="err" orientation="right" tick={CHART_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={28} />
                      <Tooltip {...TOOLTIP} />
                      <Line yAxisId="rps" type="monotone" dataKey="rps" stroke="#22C55E" strokeWidth={2} dot={false} name="RPS" />
                      <Line yAxisId="err" type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2} dot={false} name="Error %" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Box>
            {/* Node Health */}
            <Box sx={{ width: 260, flexShrink: 0, bgcolor: "background.elevated", borderRadius: 1, border: "1px solid", borderColor: "divider", p: 2, overflowY: "auto" }}>
              <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "text.secondary", mb: 1 }}>Node Health</Typography>
              {nodeGridData.length === 0 ? (
                <Box sx={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="caption" sx={{ color: "text.placeholder", fontSize: "0.6rem" }}>No node data</Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {nodeGridData.map((m) => {
                    const statusColor = m.isFailed ? "#ef4444" : m.isBottleneck ? "#fb923c" : m.errorRate > 0.05 ? "#facc15" : "#22c55e";
                    return (
                      <Paper key={m.nodeId} variant="outlined" sx={{ p: 0.75, bgcolor: "background.paper", borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: statusColor }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "text.primary", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.label}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "text.secondary" }}>
                            {fmt(m.currentRPS)} RPS · {pct(m.errorRate)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ fontSize: "0.55rem", fontFamily: spatialTokens.font.mono, color: "text.secondary", flexShrink: 0 }}>
                          {fmt(m.latencyMs)}ms
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>
        )}
        {activeTab === 1 && <LogsPanel />}
        {activeTab === 2 && <TracesPanel />}
        {activeTab === 3 && <SLOPanel />}
        {activeTab === 4 && <IncidentTimeline />}
      </Box>
    </Box>
  );
}

function KpiPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: "999px", bgcolor: "rgba(255,255,255,0.04)" }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "text.secondary" }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontFamily: spatialTokens.font.mono, fontWeight: 600, color: "text.primary" }}>{value}</Typography>
    </Box>
  );
}

function TabButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.5, cursor: "pointer", userSelect: "none",
        fontSize: "0.65rem", fontWeight: active ? 600 : 500,
        color: active ? "text.primary" : "text.secondary",
        borderBottom: "2px solid",
        borderColor: active ? "primary.main" : "transparent",
        "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.03)" },
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: active ? "primary.main" : "text.disabled", ml: 0.25 }}>
          ({count > 99 ? "99+" : count})
        </Typography>
      )}
    </Box>
  );
}
