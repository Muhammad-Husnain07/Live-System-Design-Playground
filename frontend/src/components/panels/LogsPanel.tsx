import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../utils/api";
import { useSimulationStore } from "../../store/simulationStore";
import { useObservabilityStore, type SimLogEntry } from "../../store/observabilityStore";
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Select, MenuItem, FormControl, Tooltip,
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

  // When correlationTraceId changes, set the filter and switch to logs tab
  useEffect(() => {
    if (correlationTraceId) {
      setTraceId(correlationTraceId);
      setPage(1);
    }
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: "#27272a", flexShrink: 0 }}>
        <TextField
          size="small" placeholder="service" value={service}
          onChange={(e) => { setService(e.target.value); setPage(1); }}
          sx={{ "& .MuiInputBase-root": { fontSize: "0.65rem", height: 28, color: "#a1a1aa", bgcolor: "#18181b" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" } }}
        />
        <FormControl size="small" sx={{ minWidth: 72 }}>
          <Select
            value={level} displayEmpty onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            sx={{ fontSize: "0.65rem", height: 28, color: "#a1a1aa", bgcolor: "#18181b", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" } }}
          >
            <MenuItem value="" sx={{ fontSize: "0.65rem" }}>level</MenuItem>
            {LEVELS.filter(Boolean).map((l) => (
              <MenuItem key={l} value={l} sx={{ fontSize: "0.65rem", color: levelColor(l), fontWeight: levelWeight(l) }}>{l}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small" placeholder="traceId" value={traceId}
          onChange={(e) => { setTraceId(e.target.value); setPage(1); }}
          sx={{ "& .MuiInputBase-root": { fontSize: "0.65rem", height: 28, color: "#a1a1aa", bgcolor: "#18181b" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" }, flex: 1 }}
        />
        <Tooltip title="Refresh" arrow>
          <IconButton size="small" onClick={fetchLogs} sx={{ color: "#71717a" }}>
            <RefreshCw size={14} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#52525b", whiteSpace: "nowrap" }}>
          {logTotal} results
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <Table size="small" sx={{ "& .MuiTableCell-root": { borderColor: "#27272a" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 0.5, px: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", width: 44 }}>Level</TableCell>
              <TableCell sx={{ py: 0.5, px: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", width: 80 }}>Time</TableCell>
              <TableCell sx={{ py: 0.5, px: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", width: 90 }}>Service</TableCell>
              <TableCell sx={{ py: 0.5, px: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a" }}>Message</TableCell>
              <TableCell sx={{ py: 0.5, px: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a", width: 60, textAlign: "right" }}>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: "center", py: 4, fontSize: "0.6rem", color: "#52525b", border: "none" }}>
                  {isRunning ? "Waiting for logs…" : "Start a simulation to see logs"}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log, i) => (
                <TableRow key={`${log.spanId}-${i}`} hover sx={{ "&:hover": { bgcolor: "#27272a" } }}>
                  <TableCell sx={{ py: 0.5, px: 0.75, border: "none", fontSize: "0.6rem", fontFamily: "monospace", fontWeight: levelWeight(log.level), color: levelColor(log.level) }}>
                    {log.level}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.75, border: "none", fontSize: "0.55rem", fontFamily: "monospace", color: "#71717a" }}>
                    {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.75, border: "none", fontSize: "0.6rem", color: "#22d3ee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.service}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.75, border: "none", fontSize: "0.6rem", fontFamily: "monospace", color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.message}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, px: 0.75, border: "none", fontSize: "0.55rem", fontFamily: "monospace", color: "#71717a", textAlign: "right" }}>
                    {log.durationMs > 0 ? `${Math.round(log.durationMs)}ms` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 0.75, borderTop: 1, borderColor: "#27272a", flexShrink: 0 }}>
        <IconButton size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} sx={{ color: "#71717a", fontSize: "0.7rem" }}>
          ‹
        </IconButton>
        <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#71717a" }}>
          Page {page} of {totalPages}
        </Typography>
        <IconButton size="small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} sx={{ color: "#71717a", fontSize: "0.7rem" }}>
          ›
        </IconButton>
      </Box>
    </Box>
  );
}
