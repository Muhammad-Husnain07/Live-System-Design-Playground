import { useEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useObservabilityStore, type SimLogEntry } from "../../store/observabilityStore";
import { useSimulationStore } from "../../store/simulationStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import { useChaosStore } from "../../store/chaosStore";
import { spatialTokens } from "../../theme/spatialTokens";
import api, { getErrorMessage } from "../../utils/api";
import { Box, Typography } from "@mui/material";
import { Terminal } from "lucide-react";

const LEVEL_WEIGHT: Record<string, number> = { CRITICAL: 700, ERROR: 600, WARN: 500, INFO: 400 };
const LEVEL_COLOR: Record<string, string> = { CRITICAL: spatialTokens.accent.error, ERROR: spatialTokens.accent.error, WARN: "#f97316", INFO: spatialTokens.text.secondary };
const LEVEL_BG: Record<string, string> = {
  CRITICAL: "rgba(239,68,68,0.08)", ERROR: "rgba(239,68,68,0.04)",
  WARN: "rgba(249,115,22,0.06)", INFO: "transparent",
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function LogEntryRow({ log, index }: { log: SimLogEntry; index: number }) {
  const bg = index % 2 === 0 ? "rgba(10,10,11,0.4)" : "transparent";
  return (
    <Box
      sx={{
        display: "flex", gap: 1, px: 1.5, py: 0.15, fontSize: "0.6rem",
        fontFamily: spatialTokens.font.mono,
        bgcolor: LEVEL_BG[log.level] || bg, color: "#d4d4d8",
        alignItems: "center", minHeight: 18,
        borderLeft: `2px solid ${LEVEL_COLOR[log.level] || "transparent"}`,
        transition: "background 0.1s",
        "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
      }}
    >
      <Box sx={{ width: 48, flexShrink: 0, color: LEVEL_COLOR[log.level] || spatialTokens.text.secondary, fontWeight: LEVEL_WEIGHT[log.level] || 400, fontSize: "0.5rem" }}>
        {log.level}
      </Box>
      <Box sx={{ width: 80, flexShrink: 0, color: "#8B8B8F", fontSize: "0.5rem" }}>
        {formatTime(log.timestamp)}
      </Box>
      <Box sx={{ width: 72, flexShrink: 0, color: "#22d3ee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.55rem" }}>
        {log.service}
      </Box>
      <Box sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: log.level === "ERROR" || log.level === "CRITICAL" ? "#ef4444" : "#d4d4d8" }}>
        {log.message}
      </Box>
    </Box>
  );
}

const LOG_HELP = `Available commands:
  help                          Show this help
  clear                         Clear terminal
  inject chaos <type>           Inject a chaos event
    [node=<label>]                Target node label (default: selected node)
    [severity=0-1]                Severity (default: 0.5)
    [duration=<seconds>]          Duration in seconds (default: 30)

Chaos types: NodeFailure, LatencySpike, ErrorRateSpike, NetworkPartition,
             DDoS, RegionDown, MemoryLeak, CPUSaturation

Example:
  inject chaos LatencySpike node=APIGateway severity=0.8 duration=60
`;

export default memo(function QuakeTerminal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logs = useObservabilityStore((s) => s.logs);
  const logTotal = useObservabilityStore((s) => s.logTotal);
  const setLogs = useObservabilityStore((s) => s.setLogs);
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(["> Welcome to Quake Terminal. Type 'help' for commands."]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new history
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Auto-scroll logs
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Poll logs when terminal is open
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!open || !runId || !isRunning) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    const doFetch = async () => {
      try {
        const { data } = await api.get(`/simulations/${runId}/logs?perPage=200`);
        if (data.logs) setLogs(data.logs as SimLogEntry[], data.total ?? 0);
      } catch { /* log polling errors are transient */ }
    };
    doFetch();
    pollingRef.current = setInterval(doFetch, 3000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [open, runId, isRunning, setLogs]);

  // Focus input when terminal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);

    const parts = trimmed.split(/\s+/);
    const main = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (main === "help") {
      setHistory((prev) => [...prev, `> ${trimmed}`, LOG_HELP]);
      return;
    }

    if (main === "clear") {
      setHistory([]);
      return;
    }

    if (main === "inject" && args[0]?.toLowerCase() === "chaos" && args[1]) {
      const eventType = args[1];
      const kv: Record<string, string> = {};
      for (const a of args.slice(2)) {
        const eqIdx = a.indexOf("=");
        if (eqIdx > 0) kv[a.slice(0, eqIdx).toLowerCase()] = a.slice(eqIdx + 1);
      }

      const currentRunId = useSimulationStore.getState().runId;
      if (!currentRunId) {
        setHistory((prev) => [...prev, `> ${trimmed}`, "  ERROR: No active simulation. Start one first."]);
        return;
      }

      const nodes = useCanvasStore.getState().nodes;
      let nodeId = useCanvasStore.getState().selectedNodeId || "";

      if (kv.node) {
        const found = nodes.find((n) => n.data?.label?.toLowerCase() === kv.node.toLowerCase());
        if (found) nodeId = found.id;
        else {
          setHistory((prev) => [...prev, `> ${trimmed}`, `  ERROR: Node "${kv.node}" not found on canvas.`]);
          return;
        }
      }

      if (!nodeId) {
        setHistory((prev) => [...prev, `> ${trimmed}`, "  ERROR: No node specified and no node selected. Use node=<label> or select a node first."]);
        return;
      }

      const severity = Math.min(1, Math.max(0, parseFloat(kv.severity || "0.5")));
      const durationSeconds = Math.max(1, parseInt(kv.duration || "30", 10));

      try {
        await api.post("/chaos/inject", {
          simulationRunId: currentRunId, nodeId, eventType,
          severity, durationSeconds,
        });
        useChaosStore.getState().setLastChaosInjectionAt(Date.now());
        setHistory((prev) => [...prev, `> ${trimmed}`, `  Injected ${eventType} on node ${nodeId} (severity: ${severity}, duration: ${durationSeconds}s)`]);
        useToastStore.getState().addToast({ type: "success", title: `${eventType} injected`, duration: 3000 });
      } catch (err: any) {
        const msg = getErrorMessage(err, "Injection failed.");
        setHistory((prev) => [...prev, `> ${trimmed}`, `  ERROR: ${msg}`]);
      }
      return;
    }

    setHistory((prev) => [...prev, `> ${trimmed}`, `  Unknown command: ${main}. Type 'help' for available commands.`]);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = historyIdx < cmdHistory.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(newIdx);
        setInput(cmdHistory[cmdHistory.length - 1 - newIdx] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(cmdHistory[cmdHistory.length - 1 - newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    }
  }, [input, executeCommand, cmdHistory, historyIdx]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="quake-terminal"
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "40vh",
            zIndex: spatialTokens.z.quakeTerminal,
            background: spatialTokens.bg.islandDarker,
            backdropFilter: "blur(24px) saturate(180%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          {/* Terminal header */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1.5,
            px: 2, py: 0.75, borderBottom: "1px solid rgba(255,255,255,0.05)",
            flexShrink: 0, bgcolor: "rgba(10,10,11,0.5)",
          }}>
            <Terminal size={13} color="#22d3ee" />
            <Typography sx={{ fontSize: "0.6rem", fontWeight: 600, color: "#8B8B8F", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Terminal
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {isRunning && (
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
              )}
              <Typography sx={{ fontSize: "0.5rem", color: "#555558", fontFamily: spatialTokens.font.mono }}>
                {logTotal} logs
              </Typography>
              <Box
                onClick={onClose}
                sx={{
                  ml: 1.5, cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: "0.65rem",
                  p: 0.35, borderRadius: "4px", lineHeight: 1,
                  "&:hover": { color: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" },
                }}
              >
                ✕
              </Box>
            </Box>
          </Box>

          {/* Log viewer */}
          <Box
            ref={scrollRef}
            sx={{
              flex: 1, overflowY: "auto", minHeight: 0,
              bgcolor: "rgba(5,5,7,0.6)",
              fontFamily: spatialTokens.font.mono,
            }}
          >
            {/* Command history */}
            {history.map((line, i) => {
              if (line.startsWith("> ")) {
                return (
                  <Box key={`h-${i}`} sx={{ px: 1.5, py: 0.15, fontSize: "0.6rem", fontFamily: spatialTokens.font.mono, color: "#22d3ee", bgcolor: "rgba(34,211,238,0.03)" }}>
                    {line}
                  </Box>
                );
              }
              if (line.startsWith("  ")) {
                const isErr = line.includes("ERROR") || line.includes("error");
                return (
                  <Box key={`h-${i}`} sx={{ px: 1.5, py: 0.15, fontSize: "0.6rem", fontFamily: spatialTokens.font.mono, color: isErr ? "#ef4444" : "#a1a1aa", whiteSpace: "pre-wrap" }}>
                    {line}
                  </Box>
                );
              }
              if (line.startsWith("Available")) {
                return (
                  <Box key={`h-${i}`} sx={{ px: 1.5, py: 0.15, fontSize: "0.55rem", fontFamily: spatialTokens.font.mono, color: "#8B8B8F", whiteSpace: "pre-wrap" }}>
                    {line}
                  </Box>
                );
              }
              return (
                <Box key={`h-${i}`} sx={{ px: 1.5, py: 0.15, fontSize: "0.6rem", fontFamily: spatialTokens.font.mono, color: "#a1a1aa" }}>
                  {line}
                </Box>
              );
            })}

            {/* Log entries */}
            {logs.length > 0 && <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.04)", mt: 0.5 }} />}
            {logs.slice(-200).map((log, i) => (
              <LogEntryRow key={`${log.spanId}-${i}`} log={log} index={i} />
            ))}
            <div ref={logEndRef} />
          </Box>

          {/* Command input */}
          <Box sx={{
            display: "flex", alignItems: "center",
            px: 1.5, py: 0.5, borderTop: "1px solid rgba(255,255,255,0.06)",
            bgcolor: "rgba(10,10,11,0.6)", flexShrink: 0,
          }}>
            <Typography sx={{ fontSize: "0.65rem", fontFamily: spatialTokens.font.mono, color: "#22d3ee", mr: 1, flexShrink: 0 }}>
              $
            </Typography>
            <Box
              component="input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command…"
              sx={{
                flex: 1, border: "none", outline: "none", bgcolor: "transparent",
                fontFamily: spatialTokens.font.mono, fontSize: "0.65rem",
                color: spatialTokens.text.primary, caretColor: "#22d3ee",
                "&::placeholder": { color: spatialTokens.text.placeholder, opacity: 1 },
              }}
            />
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
