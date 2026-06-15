import { create } from "zustand";

export interface SpanData {
  spanId: string; traceId: string; nodeId: string; nodeLabel: string;
  nodeType: string; entryTime: string; exitTime: string; durationMs: number;
  status: "OK" | "ERROR"; spanType?: "CACHE_HIT" | "ASYNC_WAIT" | "";
}

export interface TraceData {
  traceId: string; spans: SpanData[]; rootNodeId: string; rootNodeLabel: string;
  startTime: string; endTime: string; totalDurationMs: number;
  status: "OK" | "ERROR"; hasError: boolean;
}

export interface SimLogEntry {
  timestamp: string; traceId: string; spanId: string; service: string;
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL"; message: string;
  durationMs: number; nodeId: string;
}

interface ObservabilityStore {
  traces: TraceData[];
  selectedTrace: TraceData | null;
  correlationTraceId: string;
  logs: SimLogEntry[];
  logTotal: number;
  activeBottomTab: "traces" | "logs";

  setTraces: (traces: TraceData[]) => void;
  setSelectedTrace: (trace: TraceData | null) => void;
  setCorrelationTraceId: (traceId: string) => void;
  setLogs: (logs: SimLogEntry[], total: number) => void;
  appendLogs: (logs: SimLogEntry[]) => void;
  setActiveBottomTab: (tab: "traces" | "logs") => void;
}

export const useObservabilityStore = create<ObservabilityStore>((set) => ({
  traces: [],
  selectedTrace: null,
  correlationTraceId: "",
  logs: [],
  logTotal: 0,
  activeBottomTab: "traces",

  setTraces: (traces) => set({ traces }),
  setSelectedTrace: (trace) => set({ selectedTrace: trace }),
  setCorrelationTraceId: (traceId) => set({ correlationTraceId: traceId }),
  setLogs: (logs, total) => set({ logs, logTotal: total }),
  appendLogs: (newLogs) =>
    set((s) => ({ logs: [...s.logs, ...newLogs].slice(-5000) })),
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
}));
