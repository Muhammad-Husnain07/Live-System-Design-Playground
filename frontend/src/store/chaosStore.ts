import { Bomb, Timer, AlertTriangle, PlugZap, Zap, Earth, TrendingUp, Flame, type LucideIcon } from "lucide-react";
import { create } from "zustand";

export interface ChaosEventData {
  id: string;
  simulationRunId: string;
  nodeId: string;
  eventType: string;
  severity: number;
  durationTicks: number;
  startedAt: number;
  active: boolean;
}

export interface ChaosDefinition {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const CHAOS_TYPES: ChaosDefinition[] = [
  { type: "NodeFailure", label: "Node Failure", description: "Target node goes down — traffic is dropped", icon: Bomb, color: "#EF4444" },
  { type: "LatencySpike", label: "Latency Spike", description: "Multiply latency up to 10× — requests slow down", icon: Timer, color: "#F97316" },
  { type: "ErrorRateSpike", label: "Error Rate Spike", description: "Spike error rate — responses start failing", icon: AlertTriangle, color: "#EAB308" },
  { type: "NetworkPartition", label: "Network Partition", description: "Node isolated — all incoming traffic dropped", icon: PlugZap, color: "#A855F7" },
  { type: "DDoS", label: "DDoS Attack", description: "Overwhelm node — capacity crushed", icon: Zap, color: "#EC4899" },
  { type: "RegionDown", label: "Region Down", description: "Entire region fails — all nodes in region affected", icon: Earth, color: "#DC2626" },
  { type: "MemoryLeak", label: "Memory Leak", description: "Gradual degradation — memory creeps up over time", icon: TrendingUp, color: "#06B6D4" },
  { type: "CPUSaturation", label: "CPU Saturation", description: "CPU pinned at 100% — throughput collapses", icon: Flame, color: "#F97316" },
];

interface ChaosState {
  activeEvents: ChaosEventData[];
  activeNodeIds: string[];
  showChaosPanel: boolean;
  lastChaosInjectionAt: number;
  setActiveEvents: (events: ChaosEventData[]) => void;
  addActiveEvent: (event: ChaosEventData) => void;
  removeActiveEvent: (id: string) => void;
  setShowChaosPanel: (show: boolean) => void;
  setLastChaosInjectionAt: (ts: number) => void;
  reset: () => void;
}

export const useChaosStore = create<ChaosState>((set) => ({
  activeEvents: [],
  activeNodeIds: [],
  showChaosPanel: false,
  lastChaosInjectionAt: 0,
  setActiveEvents: (events) => set({ activeEvents: events, activeNodeIds: [...new Set(events.map((e) => e.nodeId))] }),
  addActiveEvent: (event) =>
    set((s) => ({
      activeEvents: [...s.activeEvents, event],
      activeNodeIds: [...new Set([...s.activeNodeIds, event.nodeId])],
    })),
  removeActiveEvent: (id) =>
    set((s) => {
      const filtered = s.activeEvents.filter((e) => e.id !== id);
      return { activeEvents: filtered, activeNodeIds: [...new Set(filtered.map((e) => e.nodeId))] };
    }),
  setShowChaosPanel: (show) => set({ showChaosPanel: show }),
  setLastChaosInjectionAt: (ts) => set({ lastChaosInjectionAt: ts }),
  reset: () => set({ activeEvents: [], activeNodeIds: [], showChaosPanel: false, lastChaosInjectionAt: 0 }),
}));
