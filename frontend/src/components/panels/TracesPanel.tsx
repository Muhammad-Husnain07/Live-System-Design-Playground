import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../utils/api";
import { useSimulationStore } from "../../store/simulationStore";
import { useObservabilityStore, type TraceData } from "../../store/observabilityStore";
import { Box, Typography, TextField, IconButton } from "@mui/material";
import { RefreshCw } from "lucide-react";

function spanColor(label: string): string {
  const h = [...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${h}, 50%, 55%)`;
}

export default function TracesPanel() {
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const traces = useObservabilityStore((s) => s.traces);
  const setTraces = useObservabilityStore((s) => s.setTraces);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) setExpanded(new Set());
  }, [isRunning]);

  const fetchTraces = useCallback(async () => {
    if (!runId) return;
    try {
      const params = new URLSearchParams();
      if (search) params.set("operation", search);
      const { data } = await api.get(`/simulations/${runId}/traces?${params.toString()}`);
      if (data.traces) setTraces(data.traces as TraceData[]);
    } catch { /* ignore */ }
  }, [runId, search, setTraces]);

  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isRunning || !runId) { setTraces([]); return; }
    fetchTraces();
    autoRef.current = setInterval(fetchTraces, 4000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [isRunning, runId, fetchTraces, setTraces]);

  function toggleExpand(traceId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(traceId)) next.delete(traceId); else next.add(traceId);
      return next;
    });
  }

  const m = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(2)}s`;
    return `${Math.round(v)}ms`;
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Filter bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <TextField
          size="small" placeholder="Filter by operation…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ "& .MuiInputBase-root": { fontSize: "0.6rem", height: 26, color: "text.secondary", bgcolor: "background.default" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" }, flex: 1 }}
        />
        <IconButton size="small" onClick={fetchTraces} sx={{ color: "text.secondary" }}><RefreshCw size={13} /></IconButton>
        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "text.placeholder", whiteSpace: "nowrap" }}>{traces.length} traces</Typography>
      </Box>

      {/* Trace list */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, fontFamily: '"JetBrains Mono", monospace' }}>
        {traces.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Typography variant="caption" sx={{ color: "text.placeholder", fontSize: "0.6rem", fontFamily: '"Inter", sans-serif' }}>
              {isRunning ? "Waiting for traces…" : "Start a simulation to see traces"}
            </Typography>
          </Box>
        ) : (
          traces.map((trace, i) => {
            const isOpen = expanded.has(trace.traceId);
            const hasError = trace.hasError;
            return (
              <Box key={trace.traceId}>
                {/* Trace header row */}
                <Box
                  onClick={() => toggleExpand(trace.traceId)}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.5,
                    bgcolor: i % 2 === 0 ? "#0A0A0B" : "#1E1E20",
                    borderLeft: hasError ? "2px solid #EF4444" : "2px solid transparent",
                    cursor: "pointer", userSelect: "none",
                    "&:hover": { bgcolor: "#252528" },
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "text.secondary", minWidth: 52 }}>{m(trace.totalDurationMs)}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: "0.55rem", color: hasError ? "#EF4444" : "#e4e4e7", fontWeight: hasError ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {trace.traceId.slice(0, 16)}…
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "#8B8B8F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {trace.rootNodeLabel ?? "unknown"}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "#8B8B8F", whiteSpace: "nowrap" }}>
                    {trace.spans.length} spans
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#6366F1", ml: 0.5 }}>{isOpen ? "▾" : "▸"}</Typography>
                </Box>

                {/* Expanded spans */}
                {isOpen && (
                  <Box sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                    {trace.spans.map((span) => (
                      <Box
                        key={span.spanId}
                        onClick={() => setSelected(selected === span.spanId ? null : span.spanId)}
                        sx={{
                          display: "flex", alignItems: "center", gap: 1,
                          px: 1.5, py: 0.3, borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
                          bgcolor: selected === span.spanId ? "rgba(99,102,241,0.08)" : "transparent",
                          "&:hover": { bgcolor: "rgba(99,102,241,0.05)" },
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: spanColor(span.nodeLabel) }} />
                        <Typography variant="caption" sx={{ fontSize: "0.5rem", color: span.status === "ERROR" ? "#EF4444" : "#a1a1aa", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {span.nodeLabel}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.45rem", color: "#8B8B8F", whiteSpace: "nowrap", minWidth: 32, textAlign: "right" }}>
                          {m(span.durationMs)}
                        </Typography>
                        <Box sx={{ width: `${Math.max(4, (span.durationMs / trace.totalDurationMs) * 60)}px`, height: 3, borderRadius: 2, bgcolor: span.status === "ERROR" ? "#EF4444" : spanColor(span.nodeLabel), flexShrink: 0, ml: 1 }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
