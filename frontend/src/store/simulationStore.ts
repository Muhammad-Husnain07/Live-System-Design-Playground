import { create } from "zustand";

export interface NodeMetricsSnapshot {
  nodeId: string;
  nodeType: string;
  label: string;
  incomingRPS: number;
  currentRPS: number;
  canaryRPS: number;
  maxRPS: number;
  instances: number;
  latencyMs: number;
  errorRate: number;
  queueDepth: number;
  isBottleneck: boolean;
  overflowRPS: number;
  cpuPercent: number;
  memoryPercent: number;
  errorCount: number;
  p99LatencyMs: number;
  isFailed: boolean;
  isAsync: boolean;
  activeGroup?: string;
  blueGreenGroup?: string;
  retryCount: number;
  droppedRequests: number;
  cacheHitRatio: number;
  connectionPoolMax: number;
  coldStartMs: number;
  diskIOPSMax: number;
  isPrimaryDB: boolean;
  activeConnections: number;
  desiredInstances: number;
  scalingEvent: string;
  computeTier: string;
  replicationRole: string;
  replicationLagMs: number;
  staleReadCount: number;
  isSplitBrain: boolean;
  dataInconsistency: number;
  spotInterrupted: boolean;
}

export interface TickData {
  tickNumber: number;
  timestamp: string;
  nodeMetrics: NodeMetricsSnapshot[];
  totalRPS: number;
  globalErrorRate: number;
  activeRequests: number;
}

export interface SimConfig {
  targetRPS: number;
  durationSeconds: number;
  speedMultiplier: number;
  trafficPattern: string;
}

interface SimulationState {
  isRunning: boolean;
  ticks: TickData[];
  latestTick: TickData | null;
  config: SimConfig;
  runId: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  elapsed: number;

  setConfig: (partial: Partial<SimConfig>) => void;
  setRunning: (running: boolean) => void;
  setRunId: (id: string | null) => void;
  setConnectionStatus: (status: SimulationState["connectionStatus"]) => void;
  setElapsed: (elapsed: number) => void;
  onTick: (tick: TickData) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  isRunning: false,
  ticks: [],
  latestTick: null,
  config: {
    targetRPS: 2000,
    durationSeconds: 60,
    speedMultiplier: 1,
    trafficPattern: "steady",
  },
  runId: null,
  connectionStatus: "disconnected",
  elapsed: 0,

  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),

  setRunning: (running) => set({ isRunning: running }),

  setRunId: (id) => set({ runId: id }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setElapsed: (elapsed) => set({ elapsed }),

  appendTicks: (newTicks) => {
    const { ticks } = get();
    set({ ticks: [...ticks, ...newTicks].slice(-5000), latestTick: newTicks[newTicks.length - 1] });
  },

  onTick: (tick) => {
    const { ticks } = get();
    set({ ticks: [...ticks, tick].slice(-5000), latestTick: tick });
  },

  reset: () =>
    set({
      isRunning: false,
      ticks: [],
      latestTick: null,
      runId: null,
      connectionStatus: "disconnected",
      elapsed: 0,
    }),
}));
