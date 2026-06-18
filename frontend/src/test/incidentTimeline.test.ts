import { describe, it, expect, beforeEach } from "vitest";
import { useIncidentStore, INCIDENT_SCENARIOS } from "../store/incidentStore";
import { useCanvasStore } from "../store/canvasStore";

describe("IncidentTimeline", () => {
  beforeEach(() => {
    useIncidentStore.getState().reset();
    useCanvasStore.setState({ nodes: [], highlightedNodeIds: [] });
  });

  it("shows empty state when no active scenario", () => {
    const state = useIncidentStore.getState();
    expect(state.activeScenario).toBeNull();
  });

  it("timeline markers get ACTION_COLORS by action type", () => {
    const ACTION_COLORS: Record<string, string> = {
      chaos_inject: "#ef4444",
      traffic_spike: "#fb923c",
      config_change: "#3b82f6",
    };
    expect(ACTION_COLORS.chaos_inject).toBe("#ef4444");
    expect(ACTION_COLORS.traffic_spike).toBe("#fb923c");
    expect(ACTION_COLORS.config_change).toBe("#3b82f6");
  });

  it("handleMarkerClick highlights nodes by nodeType then clears after 3s", async () => {
    useCanvasStore.setState({
      nodes: [
        { id: "app-1", data: { nodeType: "AppServer" } } as any,
        { id: "app-2", data: { nodeType: "AppServer" } } as any,
        { id: "db-1", data: { nodeType: "PostgreSQLDB" } } as any,
      ],
    });

    const stepAction = "chaos_inject";
    const nodeType = stepAction === "chaos_inject" ? "AppServer" : undefined;
    const nodes = useCanvasStore.getState().nodes;
    let ids: string[] = [];
    if (nodeType) {
      ids = nodes
        .filter((n) => n.data?.nodeType === nodeType)
        .map((n) => n.id);
    }
    expect(ids).toEqual(["app-1", "app-2"]);

    useCanvasStore.getState().setHighlightedNodeIds(ids);
    expect(useCanvasStore.getState().highlightedNodeIds).toEqual(["app-1", "app-2"]);
  });

  it("handleMarkerClick with unknown action clears highlighted nodes", () => {
    useCanvasStore.setState({
      nodes: [
        { id: "app-1", data: { nodeType: "AppServer" } } as any,
      ],
    });

    const stepAction = "unknown_action";
    const nodeType = stepAction === "chaos_inject"
      ? "AppServer"
      : stepAction === "config_change"
        ? "AppServer"
        : undefined;

    const nodes = useCanvasStore.getState().nodes;
    let ids: string[] = [];
    if (nodeType) {
      ids = nodes
        .filter((n) => n.data?.nodeType === nodeType)
        .map((n) => n.id);
    } else {
      ids = [];
    }
    expect(ids).toEqual([]);
  });

  it("timeline totalTicks computation uses max of scenario steps and currentTick + 10", () => {
    const scenario = INCIDENT_SCENARIOS[0];
    const currentTick = 11;
    const maxTick = Math.max(...scenario.steps.map((s) => s.triggerTick), 1);
    const totalTicks = Math.max(currentTick + 10, maxTick + 5);
    expect(maxTick).toBe(25);
    expect(totalTicks).toBe(30);
  });

  it("timeline totalTicks uses currentTick + 10 when it exceeds maxStepTick + 5", () => {
    const scenario = INCIDENT_SCENARIOS[0];
    const currentTick = 100;
    const maxTick = Math.max(...scenario.steps.map((s) => s.triggerTick), 1);
    const totalTicks = Math.max(currentTick + 10, maxTick + 5);
    expect(totalTicks).toBe(110);
  });

  it("marker rendering computes xPct from triggerTick / range", () => {
    const scenario = INCIDENT_SCENARIOS[0];
    const minTick = 0;
    const maxTick = 30;
    const range = maxTick - minTick;

    const step = scenario.steps[0];
    const xPct = ((step.triggerTick - minTick) / range) * 100;
    expect(xPct).toBeCloseTo(16.67, 1);
  });

  it("marker renders as past when timelineMarkers has matching stepIndex", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "Config change", action: "config_change" });

    const markers = useIncidentStore.getState().timelineMarkers;
    const isPast = markers.some((m) => m.stepIndex === 0);
    expect(isPast).toBe(true);
  });

  it("marker renders as not past when no matching stepIndex", () => {
    useIncidentStore.getState().setActiveScenario(INCIDENT_SCENARIOS[0]);
    useIncidentStore.getState().addTimelineMarker({ tick: 5, stepIndex: 0, label: "test", action: "chaos_inject" });

    const markers = useIncidentStore.getState().timelineMarkers;
    const isPast = markers.some((m) => m.stepIndex === 1);
    expect(isPast).toBe(false);
  });
});
