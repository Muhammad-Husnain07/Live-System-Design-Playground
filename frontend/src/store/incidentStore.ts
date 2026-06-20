import { create } from "zustand";
import api, { getErrorMessage } from "../utils/api";
import { useToastStore } from "./toastStore";
import type { IncidentScenario, TimelineMarker, PostMortem } from "../types/incident";
import type { TickData } from "./simulationStore";

export const INCIDENT_SCENARIOS: IncidentScenario[] = [
  {
    id: "retry-storm",
    name: "The Retry Storm",
    description: "A downstream service becomes slow, triggering cascading retries that overwhelm upstream caches and databases.",
    industry: "Media",
    color: "#a855f7",
    steps: [
      { triggerTick: 5, action: "config_change", label: "AppServer latency + error rate increase" },
      { triggerTick: 5, action: "chaos_inject", label: "AppServer Latency Spike" },
      { triggerTick: 12, action: "traffic_spike", label: "Traffic 3× Spike" },
      { triggerTick: 25, action: "config_change", label: "AppServer config restored" },
    ],
  },
  {
    id: "cache-avalanche",
    name: "The Cache Avalanche",
    description: "A Redis cache cluster fails, redirecting all read traffic to the primary database causing connection pool exhaustion.",
    industry: "E-Commerce",
    color: "#f59e0b",
    steps: [
      { triggerTick: 5, action: "chaos_inject", label: "Redis Node Failure" },
      { triggerTick: 5, action: "config_change", label: "Cache hit ratio drops to 0" },
      { triggerTick: 8, action: "traffic_spike", label: "Traffic 2.5× Spike" },
      { triggerTick: 20, action: "config_change", label: "Cache hit ratio restored" },
    ],
  },
  {
    id: "noisy-neighbor",
    name: "The Noisy Neighbor",
    description: "A rogue microservice consumes all CPU on a shared node, starving co-located services and causing cascading timeouts.",
    industry: "Finance",
    color: "#22c55e",
    steps: [
      { triggerTick: 5, action: "chaos_inject", label: "Microservice CPU Saturation" },
      { triggerTick: 8, action: "config_change", label: "Microservice throttled (50 maxRPS)" },
      { triggerTick: 18, action: "config_change", label: "Microservice restored" },
    ],
  },
];

function generatePostMortem(scenario: IncidentScenario, ticks: TickData[]): PostMortem {
  const latestTick = ticks[ticks.length - 1];
  const allMetrics = ticks.flatMap((t) => t.nodeMetrics);

  const failedNodes = new Set<string>();
  const highLatencyNodes = new Map<string, number>();
  const highErrorNodes = new Map<string, number>();

  for (const m of allMetrics) {
    if (m.isFailed) failedNodes.add(m.label);
    if (m.p99LatencyMs > 500) {
      const existing = highLatencyNodes.get(m.label) ?? 0;
      highLatencyNodes.set(m.label, Math.max(existing, m.p99LatencyMs));
    }
    if (m.errorRate > 0.1) {
      const existing = highErrorNodes.get(m.label) ?? 0;
      highErrorNodes.set(m.label, Math.max(existing, m.errorRate));
    }
  }

  const blastRadius: { nodeLabel: string; issue: string }[] = [];
  for (const label of failedNodes) blastRadius.push({ nodeLabel: label, issue: "Failed" });
  for (const [label, latency] of highLatencyNodes) {
    if (!failedNodes.has(label)) blastRadius.push({ nodeLabel: label, issue: `High latency (${Math.round(latency)}ms)` });
  }
  for (const [label, rate] of highErrorNodes) {
    if (!failedNodes.has(label) && !highLatencyNodes.has(label)) blastRadius.push({ nodeLabel: label, issue: `High error rate (${Math.round(rate * 100)}%)` });
  }

  const resolutionMap: Record<string, string> = {
    "retry-storm": "Add circuit breakers between services, implement exponential backoff with jitter, and set rate limits on downstream calls.",
    "cache-avalanche": "Deploy Redis Sentinel for automatic failover, add a local cache layer (e.g., in-memory cache with TTL), and implement connection pooling limits on the database.",
    "noisy-neighbor": "Enforce CPU/memory resource limits (Kubernetes ResourceQuota), move noisy workloads to dedicated node pools, and implement request prioritization with weighted fair queuing.",
  };

  const rootCause = latestTick
    ? [...failedNodes, ...[...highLatencyNodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1).map(([l]) => l)][0] ?? scenario.name
    : scenario.name;

  return {
    rootCause: failedNodes.size > 0 ? `${[...failedNodes].join(", ")} failure` : `${rootCause} degraded`,
    blastRadius: blastRadius.slice(0, 10),
    resolutionSuggestion: resolutionMap[scenario.id] ?? "Review system architecture and add appropriate resilience patterns.",
    scenarioName: scenario.name,
  };
}

interface IncidentState {
  activeScenario: IncidentScenario | null;
  timelineMarkers: TimelineMarker[];
  postMortem: PostMortem | null;
  highlightedNodeIds: string[];
  triggering: boolean;

  setActiveScenario: (scenario: IncidentScenario | null) => void;
  addTimelineMarker: (marker: TimelineMarker) => void;
  clearTimeline: () => void;
  triggerIncident: (runId: string) => Promise<void>;
  generatePostMortem: (ticks: TickData[]) => void;
  setHighlightedNodeIds: (ids: string[]) => void;
  clearHighlighted: () => void;
  reset: () => void;
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  activeScenario: null,
  timelineMarkers: [],
  postMortem: null,
  highlightedNodeIds: [],
  triggering: false,

  setActiveScenario: (scenario) => set({ activeScenario: scenario, timelineMarkers: [], postMortem: null, highlightedNodeIds: [] }),

  addTimelineMarker: (marker) => {
    const { timelineMarkers } = get();
    if (timelineMarkers.some((m) => m.stepIndex === marker.stepIndex)) return;
    set({ timelineMarkers: [...timelineMarkers, marker].sort((a, b) => a.tick - b.tick) });
  },

  clearTimeline: () => set({ timelineMarkers: [] }),

  triggerIncident: async (runId) => {
    const { activeScenario } = get();
    if (!activeScenario) return;
    set({ triggering: true, postMortem: null });
    try {
      await api.post(`/simulations/${runId}/start-incident`, { scenarioId: activeScenario.id });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to trigger incident.");
      useToastStore.getState().addToast({ type: "error", title: "Incident failed", message: msg, duration: 5000 });
    } finally {
      set({ triggering: false });
    }
  },

  generatePostMortem: (ticks) => {
    const { activeScenario } = get();
    if (!activeScenario || ticks.length === 0) return;
    const report = generatePostMortem(activeScenario, ticks);
    set({ postMortem: report });
  },

  setHighlightedNodeIds: (ids) => set({ highlightedNodeIds: ids }),

  clearHighlighted: () => set({ highlightedNodeIds: [] }),

  reset: () => set({ activeScenario: null, timelineMarkers: [], postMortem: null, highlightedNodeIds: [], triggering: false }),
}));
