import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../utils/api";
import { useSimulationStore } from "../../store/simulationStore";
import { useObservabilityStore, type SimLogEntry } from "../../store/observabilityStore";
import {
  Box, Typography, TextField, IconButton, Select, MenuItem, FormControl, Tooltip,
} from "@mui/material";
import { RefreshCw } from "lucide-react";

const LEVELS = ["", "INFO", "WARN", "ERROR", "CRITICAL"];

function levelColor(level: string): string {
  switch (level) {
    case "CRITICAL": return "#ef4444";
    case "ERROR": return "#ef4444";
    case "WARN": return "#f97316";
    case "INFO": return "#a1a1aa";
    default: return "#a1a1aa";
  }
}

function levelWeight(level: string): number {
  return level === "CRITICAL" ? 700 : level === "ERROR" ? 600 : 400;
}

function isError(level: string): boolean {
  return level === "ERROR" || level === "CRITICAL";
}

export default function LogsPanel() {
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const correlationTraceId = useObservabilityStore((s) => s.correlationTraceId);
  const logs = useObservabilityStore((s) => s.logs);
  const logTotal = useObservabilityStore((s) => s.logTotal);
  const setLogs = useObservabilityStore((s) => s.setLogs);

  const [service, setService] = useState("");
  const [level, setLevel] = useState("");
  const [traceId, setTraceId] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;

  useEffect(() => {
    if (correlationTraceId) { setTraceId(correlationTraceId); setPage(1); }
  }, [correlationTraceId]);

  const fetchLogs = useCallback(async () => {
    if (!runId) return;
    try {
      const params = new URLSearchParams();
      if (service) params.set("service", service);
      if (level) params.set("level", level);
      if (traceId) params.set("traceId", traceId);
      params.set("page", String(page));
      params.set("perPage", String(perPage));
      const { data } = await api.get(`/simulations/${runId}/logs?${params.toString()}`);
      if (data.logs) setLogs(data.logs as SimLogEntry[], data.total ?? 0);
    } catch { /* ignore */ }
  }, [runId, service, level, traceId, page, perPage, setLogs]);

  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isRunning || !runId) { setLogs([], 0); return; }
    fetchLogs();
    autoRef.current = setInterval(fetchLogs, 4000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [isRunning, runId, fetchLogs, setLogs]);

  const totalPages = Math.max(1, Math.ceil(logTotal / perPage));

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Filter bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <TextField
          size="small" placeholder="service" value={service}
          onChange={(e) => { setService(e.target.value); setPage(1); }}
          sx={{ "& .MuiInputBase-root": { fontSize: "0.6rem", height: 26, color: "text.secondary", bgcolor: "background.default" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" } }}
        />
        <FormControl size="small" sx={{ minWidth: 64 }}>
          <Select
            value={level} displayEmpty onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            sx={{ fontSize: "0.6rem", height: 26, color: "text.secondary", bgcolor: "background.default", "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" } }}
          >
            <MenuItem value="" sx={{ fontSize: "0.6rem" }}>level</MenuItem>
            {LEVELS.filter(Boolean).map((l) => (
              <MenuItem key={l} value={l} sx={{ fontSize: "0.6rem", color: levelColor(l), fontWeight: levelWeight(l) }}>{l}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small" placeholder="traceId" value={traceId}
          onChange={(e) => { setTraceId(e.target.value); setPage(1); }}
          sx={{ "& .MuiInputBase-root": { fontSize: "0.6rem", height: 26, color: "text.secondary", bgcolor: "background.default" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" }, flex: 1 }}
        />
        <Tooltip title="Refresh" arrow>
          <IconButton size="small" onClick={fetchLogs} sx={{ color: "text.secondary" }}>
            <RefreshCw size={13} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "text.placeholder", whiteSpace: "nowrap" }}>{logTotal} results</Typography>
      </Box>

      {/* Log table */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, fontFamily: '"JetBrains Mono", monospace' }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.55rem" }}>
          <thead>
            <tr style={{ color: "#8B8B8F", borderBottom: "1px solid #2A2A2E" }}>
              <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 500, width: 44 }}>Level</th>
              <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 500, width: 72 }}>Time</th>
              <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 500, width: 80 }}>Service</th>
              <th style={{ textAlign: "left", padding: "3px 8px", fontWeight: 500 }}>Message</th>
              <th style={{ textAlign: "right", padding: "3px 8px", fontWeight: 500, width: 52 }}>Dur</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#555558", fontFamily: '"Inter", sans-serif', fontSize: "0.6rem" }}>
                  {isRunning ? "Waiting for logs…" : "Start a simulation to see logs"}
                </td>
              </tr>
            ) : (
              logs.map((log, i) => {
                const err = isError(log.level);
                return (
                  <tr
                    key={`${log.spanId}-${i}`}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#0A0A0B" : "#1E1E20",
                      borderLeft: err ? "2px solid #EF4444" : "2px solid transparent",
                    }}
                  >
                    <td style={{ padding: "2px 8px", fontWeight: levelWeight(log.level), color: levelColor(log.level) }}>{log.level}</td>
                    <td style={{ padding: "2px 8px", color: "#8B8B8F" }}>
                      {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td style={{ padding: "2px 8px", color: "#22d3ee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.service}</td>
                    <td style={{ padding: "2px 8px", color: err ? "#EF4444" : "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.message}</td>
                    <td style={{ padding: "2px 8px", color: "#8B8B8F", textAlign: "right" }}>{log.durationMs > 0 ? `${Math.round(log.durationMs)}ms` : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Box>

      {/* Pagination */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 0.5, borderTop: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <IconButton size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} sx={{ color: "text.secondary", fontSize: "0.65rem" }}>‹</IconButton>
        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "text.placeholder" }}>Page {page} of {totalPages}</Typography>
        <IconButton size="small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} sx={{ color: "text.secondary", fontSize: "0.65rem" }}>›</IconButton>
      </Box>
    </Box>
  );
}
