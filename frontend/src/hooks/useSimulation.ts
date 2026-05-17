import { useCallback, useEffect, useRef } from "react";
import { useSimulationStore, type TickData, type SimConfig } from "../store/simulationStore";
import { useCanvasStore } from "../store/canvasStore";
import { useChaosStore } from "../store/chaosStore";
import api from "../utils/api";

const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api")
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");

export function useSimulation(projectId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const manualCloseRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);

  const applyTickToCanvas = useCallback((tick: TickData) => {
    const { nodes, edges } = useCanvasStore.getState();

    const bottleneckIds = new Set(
      tick.nodeMetrics.filter((m) => m.isBottleneck || m.cpuPercent > 80).map((m) => m.nodeId),
    );

    const updatedNodes = nodes.map((n) => {
      const snap = tick.nodeMetrics.find((m) => m.nodeId === n.id);
      if (!snap) return n;
      return {
        ...n,
        data: {
          ...n.data,
          config: {
            ...n.data.config,
            isBottleneck: !!snap.isBottleneck,
            isFailed: !!snap.isFailed,
          },
          metrics: {
            currentRPS: snap.currentRPS ?? 0,
            cpuPercent: snap.cpuPercent ?? 0,
            memoryPercent: snap.memoryPercent ?? 0,
            queueDepth: snap.queueDepth ?? 0,
            errorCount: snap.errorCount ?? 0,
            p99LatencyMs: snap.p99LatencyMs ?? 0,
            canaryRPS: snap.canaryRPS ?? 0,
          },
        },
      };
    });

    const updatedEdges = edges.map((e) => {
      const sourceBottleneck = bottleneckIds.has(e.source);
      const targetBottleneck = bottleneckIds.has(e.target);
      const isSaturated = sourceBottleneck || targetBottleneck;
      const snap = tick.nodeMetrics.find((m) => m.nodeId === e.source);
      const throughput = snap?.currentRPS ?? 0;

      return {
        ...e,
        data: {
          ...e.data,
          isSaturated,
          isAnimated: throughput > 0,
          throughputRPS: throughput,
          latencyMs: snap?.latencyMs ?? 0,
        },
      };
    });

    useCanvasStore.setState({ nodes: updatedNodes, edges: updatedEdges });
  }, []);

  const connectWsRef = useRef<(() => void) | null>(null);

  const closeWs = useCallback(() => {
    manualCloseRef.current = true;
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    reconnectAttemptRef.current = 0;
    if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    useSimulationStore.getState().setConnectionStatus("disconnected");
  }, []);

  const connectWs = useCallback(async () => {
    if (!projectId) return;
    try {
      useSimulationStore.getState().setConnectionStatus("connecting");
      const { data } = await api.post("/auth/ws-ticket");
      const ticket = data.ticket;
      const wsUrl = `${WS_BASE}/ws/simulation?ticket=${ticket}&projectId=${projectId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        useSimulationStore.getState().setConnectionStatus("connected");
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "tick") {
            const tick = msg.tick as TickData;
            useSimulationStore.getState().onTick(tick);
            applyTickToCanvas(tick);
          }
        } catch { /* skip malformed */ }
      };

      ws.onclose = () => {
        if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
        useSimulationStore.getState().setConnectionStatus("disconnected");
        wsRef.current = null;
        if (!manualCloseRef.current && useSimulationStore.getState().isRunning) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
          reconnectTimer.current = setTimeout(() => {
            if (!manualCloseRef.current && useSimulationStore.getState().isRunning) {
              connectWsRef.current?.();
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        useSimulationStore.getState().setConnectionStatus("error");
      };

      wsRef.current = ws;
    } catch {
      useSimulationStore.getState().setConnectionStatus("error");
      if (!manualCloseRef.current && useSimulationStore.getState().isRunning) {
        reconnectAttemptRef.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
        reconnectTimer.current = setTimeout(() => {
          if (!manualCloseRef.current && useSimulationStore.getState().isRunning) {
            connectWsRef.current?.();
          }
        }, delay);
      }
    }
  }, [projectId, applyTickToCanvas]);

  connectWsRef.current = connectWs;

  const start = useCallback(
    async (overrides?: Partial<SimConfig>) => {
      if (startingRef.current || useSimulationStore.getState().isRunning) return;
      startingRef.current = true;
      try {
        const cfg = { ...useSimulationStore.getState().config, ...overrides };
        const resp = await api.post("/simulations/start", {
          projectId,
          targetRPS: cfg.targetRPS,
          durationSeconds: cfg.durationSeconds,
          speedMultiplier: cfg.speedMultiplier,
          trafficPattern: cfg.trafficPattern,
        });
        const { simulationRunId } = resp.data;
        useSimulationStore.getState().setRunId(simulationRunId);
        useSimulationStore.getState().setRunning(true);
        useSimulationStore.getState().setElapsed(0);

        if (elapsedTimer.current) clearInterval(elapsedTimer.current);
        elapsedTimer.current = setInterval(() => {
          useSimulationStore.getState().setElapsed(useSimulationStore.getState().elapsed + 1);
        }, 1000);

        useCanvasStore.getState().setSimulationRunning(true);
      } catch (err) {
        useSimulationStore.getState().setRunning(false);
        console.error("sim start error:", err);
      } finally {
        startingRef.current = false;
      }
    },
    [projectId],
  );

  const stop = useCallback(async () => {
    const currentRunId = useSimulationStore.getState().runId;
    if (currentRunId) {
      try { await api.post(`/simulations/${currentRunId}/stop`); } catch { /* ignore */ }
    }
    closeWs();
    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null; }
    useSimulationStore.getState().reset();
    useCanvasStore.getState().setSimulationRunning(false);
    useChaosStore.getState().reset();
  }, [closeWs]);

  useEffect(() => {
    if (runId && projectId) connectWsRef.current?.();
  }, [runId, projectId]);

  useEffect(() => {
    return () => {
      closeWs();
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, [closeWs]);

  return { start, stop, isRunning };
}
