import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useSimulationStore } from "../../store/simulationStore";
import { useChaosStore } from "../../store/chaosStore";
import { useDeployStore } from "../../store/deploymentStore";
import { useSecurityStore } from "../../store/securityStore";
import { Box, Typography, Tabs, Tab, IconButton, List, ListItem, ListItemText, Paper } from "@mui/material";

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#27272a" };
const CHART_TICK = { fontSize: 9, fill: "#71717a" };
const TOOLTIP_STYLE = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 };

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

interface BottomDrawerProps {
  projectId: string;
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

export default function BottomDrawer({ projectId }: BottomDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [drawerHeight, setDrawerHeight] = useState(40);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const dragRef = useRef(false);

  const ticks = useSimulationStore((s) => s.ticks);
  const latestTick = useSimulationStore((s) => s.latestTick);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const elapsed = useSimulationStore((s) => s.elapsed);
  const chaosEvents = useChaosStore((s) => s.activeEvents);
  const deployStates = useDeployStore((s) => s.nodeStates);
  const violations = useSecurityStore((s) => s.violations);

  const addEvent = useCallback((type: EventEntry["type"], icon: string, message: string, detail: string) => {
    eventCounter += 1;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEvents((prev) => [{ id: `evt-${eventCounter}`, time, type, icon, message, detail }, ...prev].slice(0, 100));
  }, []);

  const prevRunning = useRef(isRunning);
  useEffect(() => {
    if (isRunning === prevRunning.current) return;
    prevRunning.current = isRunning;
    addEvent("simulation", isRunning ? "▶" : "■", isRunning ? "Simulation running" : "Simulation stopped", `elapsed ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  }, [isRunning, elapsed, addEvent]);

  useEffect(() => {
    if (chaosEvents.length === 0) return;
    const latest = chaosEvents[chaosEvents.length - 1];
    addEvent("chaos", "☠", `Chaos: ${latest.eventType}`, `severity ${Math.round(latest.severity * 100)}%`);
  }, [chaosEvents, addEvent]);

  const prevDeployCount = useRef(0);
  useEffect(() => {
    if (Object.keys(deployStates).length === prevDeployCount.current) return;
    prevDeployCount.current = Object.keys(deployStates).length;
    const latestKey = Object.keys(deployStates)[Object.keys(deployStates).length - 1];
    if (!latestKey) return;
    const state = deployStates[latestKey];
    addEvent("deployment", "🚀", `Deployment shift`, `active group: ${state.activeGroup}`);
  }, [deployStates, addEvent]);

  const prevViolationCount = useRef(0);
  useEffect(() => {
    if (violations.length === prevViolationCount.current) return;
    prevViolationCount.current = violations.length;
    const last = violations[violations.length - 1];
    if (!last) return;
    addEvent("security", "🛡", `Violation: ${last.type.replace(/_/g, " ")}`, last.message);
  }, [violations, addEvent]);

  const p99Latency = useMemo(() => {
    if (!latestTick || latestTick.nodeMetrics.length === 0) return 0;
    return Math.max(...latestTick.nodeMetrics.map((m) => m.p99LatencyMs ?? 0));
  }, [latestTick]);

  const totalRPS = latestTick?.totalRPS ?? 0;
  const errorRate = latestTick?.globalErrorRate ?? 0;

  const chartData = useMemo(() => {
    return ticks.slice(-60).map((t) => ({
      tick: t.tickNumber,
      rps: Math.round(t.totalRPS),
      errors: Math.round(t.globalErrorRate * 100),
    }));
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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    const startY = e.clientY;
    const startH = drawerHeight;
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = startY - ev.clientY;
      const newH = Math.max(15, Math.min(80, startH + (delta / window.innerHeight) * 100));
      setDrawerHeight(Math.round(newH));
    };
    const onUp = () => {
      dragRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [drawerHeight]);

  return (
    <Box sx={{ flexShrink: 0, bgcolor: "#18181b", borderTop: "1px solid #3f3f46", display: "flex", flexDirection: "column" }}>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          height: 40, px: 2, display: "flex", alignItems: "center", cursor: "pointer",
          borderBottom: expanded ? "1px solid #3f3f46" : "none",
          "&:hover": { bgcolor: "rgba(255,255,255,0.02)" },
          userSelect: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
          <KpiPill label="RPS" value={fmt(totalRPS)} color="#60a5fa" />
          <KpiPill label="Errors" value={pct(errorRate)} color={errorRate > 0.05 ? "#ef4444" : "#a1a1aa"} />
          <KpiPill label="p99" value={ms(p99Latency)} color={p99Latency > 500 ? "#fb923c" : "#a78bfa"} />
          {isRunning && (
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontFamily: "monospace", color: "#22c55e", display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
              {formatElapsed(elapsed)}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            size="small"
            component="a"
            href={`/project/${projectId}/observe`}
            onClick={(e) => { e.stopPropagation(); }}
            sx={{ color: "#71717a", "&:hover": { color: "#f4f4f5" } }}
            title="Open full observability page"
          >
            <ExternalLink size={14} />
          </IconButton>
          <IconButton size="small" sx={{ color: "#71717a", "&:hover": { color: "#f4f4f5" } }}>
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </IconButton>
        </Box>
      </Box>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${drawerHeight}vh` }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
          >
            <Box
              onMouseDown={handleResizeStart}
              sx={{
                position: "absolute", top: 0, left: 0, right: 0, height: 4, zIndex: 10,
                cursor: "ns-resize", userSelect: "none",
                "&:hover": { bgcolor: "rgba(34,197,94,0.3)" },
                transition: "background-color 0.15s",
              }}
            />
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{
                minHeight: 36, px: 2, borderBottom: "1px solid #3f3f46", flexShrink: 0,
                "& .MuiTab-root": { minHeight: 36, fontSize: "0.65rem", color: "#71717a", textTransform: "none", py: 0 },
                "& .Mui-selected": { color: "#f4f4f5" },
                "& .MuiTabs-indicator": { bgcolor: "#f4f4f5" },
              }}
            >
              <Tab label="Metrics Charts" />
              <Tab label="Event Log" />
            </Tabs>

            <Box sx={{ flex: 1, overflow: "hidden" }}>
              {activeTab === 0 && (
                <Box sx={{ display: "flex", height: "100%", gap: 1, p: 1 }}>
                  <Box sx={{ flex: 1, bgcolor: "#09090b", borderRadius: 1, border: "1px solid #27272a", p: 1.5 }}>
                    <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>Traffic Over Time</Typography>
                    {chartData.length <= 1 ? (
                      <Box sx={{ height: "calc(100% - 20px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>Waiting for data…</Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="calc(100% - 20px)">
                        <LineChart data={chartData}>
                          <CartesianGrid {...CHART_GRID} />
                          <XAxis dataKey="tick" tick={CHART_TICK} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="rps" tick={CHART_TICK} axisLine={false} tickLine={false} width={36} />
                          <YAxis yAxisId="err" orientation="right" tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Line yAxisId="rps" type="monotone" dataKey="rps" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="RPS" />
                          <Line yAxisId="err" type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Error %" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                  <Box sx={{ width: 280, flexShrink: 0, bgcolor: "#09090b", borderRadius: 1, border: "1px solid #27272a", p: 1.5, overflowY: "auto" }}>
                    <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>Node Health</Typography>
                    {nodeGridData.length === 0 ? (
                      <Box sx={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>No node data</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {nodeGridData.map((m) => {
                          const statusColor = m.isFailed ? "#ef4444" : m.isBottleneck ? "#fb923c" : m.errorRate > 0.05 ? "#facc15" : "#22c55e";
                          return (
                            <Paper key={m.nodeId} variant="outlined" sx={{ p: 0.75, bgcolor: "#18181b", borderColor: "#27272a", display: "flex", alignItems: "center", gap: 1 }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: statusColor }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#f4f4f5", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {m.label}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#71717a" }}>
                                  {fmt(m.currentRPS)} RPS · {pct(m.errorRate)}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ fontSize: "0.55rem", fontFamily: "monospace", color: "#a1a1aa", flexShrink: 0 }}>
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

              {activeTab === 1 && (
                <Box sx={{ height: "100%", overflowY: "auto", px: 1.5, py: 1 }}>
                  {events.length === 0 ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                      <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>No events yet — start a simulation</Typography>
                    </Box>
                  ) : (
                    <List dense disablePadding>
                      {events.map((ev) => (
                        <ListItem key={ev.id} disablePadding sx={{ px: 0.5, py: 0.25, borderRadius: 0.5, "&:hover": { bgcolor: "rgba(39,39,42,0.5)" } }}>
                          <Typography variant="caption" sx={{ mr: 0.5, fontSize: "0.7rem", flexShrink: 0 }}>{ev.icon}</Typography>
                          <ListItemText
                            primary={ev.message}
                            secondary={ev.detail}
                            slotProps={{
                              primary: { sx: { fontSize: "0.6rem", fontWeight: 500, color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                              secondary: { sx: { fontSize: "0.55rem", color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                            }}
                          />
                          <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "#52525b", ml: "auto", flexShrink: 0 }}>{ev.time}</Typography>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function KpiPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: "999px", bgcolor: "rgba(255,255,255,0.04)" }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#71717a" }}>{label}</Typography>
      <Typography
        key={value}
        variant="caption"
        sx={{ fontSize: "0.6rem", fontFamily: "monospace", fontWeight: 600, color: "#f4f4f5", animation: "metric-flash 0.6s ease-out" }}
      >
        {value}
      </Typography>
    </Box>
  );
}
