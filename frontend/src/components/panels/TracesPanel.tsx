import { useEffect, useCallback, useRef } from "react";
import api from "../../utils/api";
import { useSimulationStore } from "../../store/simulationStore";
import { useObservabilityStore, type TraceData } from "../../store/observabilityStore";
import { useCanvasStore } from "../../store/canvasStore";
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";

function ms(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

export default function TracesPanel() {
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const traces = useObservabilityStore((s) => s.traces);
  const selectedTrace = useObservabilityStore((s) => s.selectedTrace);
  const setTraces = useObservabilityStore((s) => s.setTraces);
  const setSelectedTrace = useObservabilityStore((s) => s.setSelectedTrace);
  const setActiveRightTab = useCanvasStore((s) => s.setActiveRightTab);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTraces = useCallback(async () => {
    if (!runId) return;
    try {
      const { data } = await api.get(`/simulations/${runId}/traces`);
      if (data.traces) setTraces(data.traces as TraceData[]);
    } catch { /* ignore */ }
  }, [runId, setTraces]);

  useEffect(() => {
    if (!isRunning || !runId) { setTraces([]); return; }
    fetchTraces();
    intervalRef.current = setInterval(fetchTraces, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, runId, fetchTraces, setTraces]);

  const handleSelect = (trace: TraceData) => {
    setSelectedTrace(trace);
    setActiveRightTab("waterfall");
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
              <TableCell colSpan={6} sx={{ textAlign: "center", py: 4, fontSize: "0.6rem", color: "#52525b", border: "none" }}>
                {isRunning ? "No traces yet — 1 in 100 requests sampled" : "Start a simulation to see traces"}
              </TableCell>
            </TableRow>
          ) : (
            traces.slice().reverse().map((t) => (
              <TableRow
                key={t.traceId}
                hover
                onClick={() => handleSelect(t)}
                selected={selectedTrace?.traceId === t.traceId}
                sx={{
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#27272a" },
                  "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.2)" },
                }}
              >
                <TableCell sx={{ py: 0.75, px: 1, border: "none" }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: t.status === "ERROR" ? "#ef4444" : "#22c55e" }} />
                </TableCell>
                <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", fontFamily: "monospace", color: "#a1a1aa" }}>{t.traceId.slice(0, 8)}…</TableCell>
                <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", color: "#71717a" }}>{t.rootNodeLabel}</TableCell>
                <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", fontFamily: "monospace", color: "#a1a1aa", textAlign: "right" }}>{ms(t.totalDurationMs)}</TableCell>
                <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.65rem", textAlign: "right", color: t.status === "ERROR" ? "#ef4444" : "#22c55e" }}>{t.status}</TableCell>
                <TableCell sx={{ py: 0.75, px: 0.5, border: "none", fontSize: "0.6rem", color: "#52525b", textAlign: "right" }}>{t.spans.length}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
