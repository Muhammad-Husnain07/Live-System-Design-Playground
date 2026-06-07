import { Box, Typography, IconButton } from "@mui/material";
import { X, CheckCircle, Clock, XCircle } from "lucide-react";
import { useObservabilityStore, type SpanData } from "../../store/observabilityStore";
import { useCanvasStore } from "../../store/canvasStore";

function ms(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

export default function WaterfallPanel() {
  const trace = useObservabilityStore((s) => s.selectedTrace);
  const setSelectedTrace = useObservabilityStore((s) => s.setSelectedTrace);
  const setCorrelationTraceId = useObservabilityStore((s) => s.setCorrelationTraceId);
  const setActiveBottomTab = useObservabilityStore((s) => s.setActiveBottomTab);
  const setActiveRightTab = useCanvasStore((s) => s.setActiveRightTabManual);

  if (!trace) {
    return (
      <Box sx={{ p: 2, textAlign: "center", mt: 4, color: "#52525b", fontSize: "0.75rem" }}>
        Select a trace from the <strong>Traces</strong> tab in the bottom drawer to view its waterfall chart.
      </Box>
    );
  }

  const maxDur = Math.max(...trace.spans.map((s) => s.durationMs), 1);

  const handleSpanClick = (span: SpanData) => {
    setCorrelationTraceId(span.traceId);
    setActiveBottomTab("logs");
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1, borderBottom: 1, borderColor: "#27272a", flexShrink: 0 }}>
        <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 500, color: "#a1a1aa" }}>
          Waterfall — <Typography variant="caption" component="span" sx={{ fontFamily: "monospace", color: "#f4f4f5", fontSize: "0.6rem" }}>{trace.traceId.slice(0, 12)}…</Typography>
          {" · "}{trace.spans.length} spans · {ms(trace.totalDurationMs)}
          {trace.hasError && <Box component="span" sx={{ ml: 0.5, color: "#ef4444", display: "inline-flex", alignItems: "center", gap: 0.25, verticalAlign: "middle", fontSize: "0.6rem" }}><XCircle size={12} /> Error</Box>}
        </Typography>
        <IconButton size="small" onClick={() => { setSelectedTrace(null); setActiveRightTab("simulate"); }} sx={{ color: "#71717a" }}>
          <X size={14} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <Box sx={{ display: "flex", bgcolor: "#27272a", px: 1.5, py: 0.75, fontSize: "0.55rem", fontWeight: 500, color: "#71717a" }}>
          <Box sx={{ width: 140, flexShrink: 0 }}>Service</Box>
          <Box sx={{ width: 52, flexShrink: 0, textAlign: "right" }}>Dur</Box>
          <Box sx={{ flex: 1, ml: 1, position: "relative", height: 16 }}>
            <Typography variant="caption" component="span" sx={{ position: "absolute", left: 0, top: 0, fontSize: "0.55rem", color: "#71717a" }}>0</Typography>
            <Typography variant="caption" component="span" sx={{ position: "absolute", right: 0, top: 0, fontSize: "0.55rem", color: "#71717a" }}>{ms(maxDur)}</Typography>
          </Box>
        </Box>
        {trace.spans.map((span, i) => {
          const pct = maxDur > 0 ? (span.durationMs / maxDur) * 100 : 0;
          const isError = span.status === "ERROR";
          const isCache = span.spanType === "CACHE_HIT";
          const isAsync = span.spanType === "ASYNC_WAIT";
          let barColor = "#3b82f6";
          let barPattern = "";
          if (isError) barColor = "#ef4444";
          else if (isCache) barColor = "#10b981";
          else if (isAsync) { barColor = "#f59e0b"; barPattern = "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 6px)"; }

          return (
            <Box
              key={span.spanId}
              onClick={() => handleSpanClick(span)}
              sx={{
                display: "flex", alignItems: "center", px: 1.5, py: 0.75,
                bgcolor: i % 2 === 0 ? "#18181b" : "#09090b",
                fontSize: "0.65rem", cursor: "pointer",
                "&:hover": { bgcolor: "#27272a" },
              }}
            >
              <Box sx={{ width: 140, flexShrink: 0, display: "flex", alignItems: "center", gap: 0.25, color: "#f4f4f5" }}>
                {isCache && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                {isAsync && <Clock size={12} style={{ color: "#f97316", flexShrink: 0 }} />}
                {isError && <XCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                {span.nodeLabel}
                <Typography variant="caption" component="span" sx={{ fontSize: "0.5rem", ml: 0.25, color: "#52525b" }}>{span.nodeType}</Typography>
              </Box>
              <Box sx={{ width: 52, flexShrink: 0, textAlign: "right", fontFamily: "monospace", color: "#a1a1aa", fontSize: "0.6rem" }}>{ms(span.durationMs)}</Box>
              <Box sx={{ flex: 1, ml: 1, position: "relative", height: 16 }}>
                <Box
                  sx={{
                    position: "absolute", top: 2, height: 12, borderRadius: "999px",
                    opacity: 0.85, bgcolor: barColor,
                    background: barPattern || barColor,
                    left: 0, width: `${Math.max(pct, 2)}%`,
                    transition: "width 0.15s ease",
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
