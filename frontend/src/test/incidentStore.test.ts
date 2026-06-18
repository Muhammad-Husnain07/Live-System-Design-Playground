import { describe, it, expect, beforeEach } from "vitest";
import { useIncidentStore, INCIDENT_SCENARIOS } from "../store/incidentStore";
import type { TickData, NodeMetricsSnapshot } from "../store/simulationStore";

describe("INCIDENT_SCENARIOS definitions", () => {
  it("has 3 scenarios", () => {
    expect(INCIDENT_SCENARIOS).toHaveLength(3);
  });

  it("each scenario has required fields", () => {
    for (const s of INCIDENT_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.industry).toBeTruthy();
      expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.steps.length).toBeGreaterThan(0);
    }
  });

  it("retry-storm scenario has 4 steps", () => {
    const rs = INCIDENT_SCENARIOS.find((s) => s.id === "retry-storm");
    expect(rs).toBeDefined();
    expect(rs!.steps).toHaveLength(4);
  });

  it("all steps have triggerTick >= 0 and valid action", () => {
    const validActions = ["chaos_inject", "traffic_spike", "config_change"];
    for (const s of INCIDENT_SCENARIOS) {
      for (const step of s.steps) {
        expect(step.triggerTick).toBeGreaterThanOrEqual(0);
        expect(validActions).toContain(step.action);
        expect(step.label).toBeTruthy();
      }
    }
  });
});

describe("incidentStore", () => {
  beforeEach(() => {
    useIncidentStore.getState().reset();
  });

  it("initial state has no active scenario", () => {
    const state = useIncidentStore.getState();
    expect(state.activeScenario).toBeNull();
    expect(state.timelineMarkers).toEqual([]);
    expect(state.postMortem).toBeNull();
    expect(state.highlightedNodeIds).toEqual([]);
    expect(state.triggering).toBe(false);
  });

  it("setActiveScenario updates the scenario and resets timeline/postmortem", () => {
    const scenario = INCIDENT_SCENARIOS[0];
    useIncidentStore.getState().setActiveScenario(scenario);
    const state = useIncidentStore.getState();
    expect(state.activeScenario).toEqual(scenario);
    expect(state.timelineMarkers).toEqual([]);
    expect(state.postMortem).toBeNull();
  });

  it("setActiveScenario with null clears everything", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().setActiveScenario(null);
    const state = useIncidentStore.getState();
    expect(state.activeScenario).toBeNull();
    expect(state.timelineMarkers).toEqual([]);
    expect(state.postMortem).toBeNull();
  });

  it("addTimelineMarker adds a marker", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "test", action: "chaos_inject" });
    expect(useIncidentStore.getState().timelineMarkers).toHaveLength(1);
    expect(useIncidentStore.getState().timelineMarkers[0].stepIndex).toBe(0);
  });

  it("addTimelineMarker deduplicates by stepIndex", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "a", action: "chaos_inject" });
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "b", action: "chaos_inject" });
    expect(useIncidentStore.getState().timelineMarkers).toHaveLength(1);
  });

  it("addTimelineMarker sorts markers by tick", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 12, stepIndex: 2, label: "c", action: "traffic_spike" });
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "a", action: "chaos_inject" });
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 1, label: "b", action: "config_change" });
    const markers = useIncidentStore.getState().timelineMarkers;
    expect(markers).toHaveLength(3);
    expect(markers[0].tick).toBe(5);
    expect(markers[1].tick).toBe(5);
    expect(markers[2].tick).toBe(12);
  });

  it("clearTimeline empties markers", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "x", action: "chaos_inject" });
    useIncidentStore.getState().clearTimeline();
    expect(useIncidentStore.getState().timelineMarkers).toEqual([]);
  });

  it("setHighlightedNodeIds sets and clears ids", () => {
    useIncidentStore.getState().setHighlightedNodeIds(["n1", "n2"]);
    expect(useIncidentStore.getState().highlightedNodeIds).toEqual(["n1", "n2"]);
    useIncidentStore.getState().clearHighlighted();
    expect(useIncidentStore.getState().highlightedNodeIds).toEqual([]);
  });

  it("generatePostMortem generates a report from tick data with failures", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    const ticks: TickData[] = [
      {
        tickNumber: 5,
        timestamp: Date.now(),
        totalRPS: 1000,
        globalErrorRate: 0.05,
        nodeMetrics: [
          { nodeId: "server-1", label: "Server 1", currentRPS: 500, p99LatencyMs: 200, errorRate: 0.01, cpuPercent: 50, memoryPercent: 40, isFailed: false, isBottleneck: false, isAsync: false, queueDepth: 0, canaryRPS: 0, isCanary: false, throughput: 500 },
          { nodeId: "db-1", label: "DB 1", currentRPS: 500, p99LatencyMs: 3000, errorRate: 0.5, cpuPercent: 90, memoryPercent: 80, isFailed: true, isBottleneck: true, isAsync: false, queueDepth: 0, canaryRPS: 0, isCanary: false, throughput: 100 },
        ],
      },
    ];
    useIncidentStore.getState().generatePostMortem(ticks);
    const pm = useIncidentStore.getState().postMortem;
    expect(pm).not.toBeNull();
    expect(pm!.scenarioName).toBe("The Retry Storm");
    expect(pm!.rootCause).toContain("failure");
    expect(pm!.blastRadius.length).toBeGreaterThan(0);
    expect(pm!.resolutionSuggestion).toBeTruthy();
  });

  it("generatePostMortem with healthy nodes produces no failures", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[1]);
    const ticks: TickData[] = [
      {
        tickNumber: 1,
        timestamp: Date.now(),
        totalRPS: 500,
        globalErrorRate: 0,
        nodeMetrics: [
          { nodeId: "redis-1", label: "Redis 1", currentRPS: 200, p99LatencyMs: 5, errorRate: 0, cpuPercent: 20, memoryPercent: 30, isFailed: false, isBottleneck: false, isAsync: false, queueDepth: 0, canaryRPS: 0, isCanary: false, throughput: 200 },
        ],
      },
    ];
    useIncidentStore.getState().generatePostMortem(ticks);
    const pm = useIncidentStore.getState().postMortem;
    expect(pm).not.toBeNull();
    expect(pm!.blastRadius.length).toBe(0);
    expect(pm!.rootCause).toContain("degraded");
  });

  it("generatePostMortem is no-op when no active scenario", () => {
    useIncidentStore.getState().generatePostMortem([]);
    expect(useIncidentStore.getState().postMortem).toBeNull();
  });

  it("generatePostMortem is no-op when ticks empty", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().generatePostMortem([]);
    expect(useIncidentStore.getState().postMortem).toBeNull();
  });

  it("generatePostMortem detects high latency nodes", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    const ticks: TickData[] = [
      {
        tickNumber: 10,
        timestamp: Date.now(),
        totalRPS: 1000,
        globalErrorRate: 0.3,
        nodeMetrics: [
          { nodeId: "app-1", label: "App 1", currentRPS: 500, p99LatencyMs: 600, errorRate: 0.05, cpuPercent: 80, memoryPercent: 70, isFailed: false, isBottleneck: false, isAsync: false, queueDepth: 10, canaryRPS: 0, isCanary: false, throughput: 500 },
        ],
      },
    ];
    useIncidentStore.getState().generatePostMortem(ticks);
    const pm = useIncidentStore.getState().postMortem;
    expect(pm).not.toBeNull();
    expect(pm!.blastRadius.some((b) => b.issue.includes("latency"))).toBe(true);
  });
});
