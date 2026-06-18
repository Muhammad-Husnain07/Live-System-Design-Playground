import { describe, it, expect, beforeEach } from "vitest";
import { useChaosStore, CHAOS_TYPES } from "../store/chaosStore";
import type { ChaosEventData } from "../store/chaosStore";

function makeEvent(overrides: Partial<ChaosEventData> = {}): ChaosEventData {
  return {
    id: "ev-1",
    simulationRunId: "run-1",
    nodeId: "node-1",
    eventType: "NodeFailure",
    severity: 0.5,
    durationTicks: 150,
    startedAt: 10,
    active: true,
    ...overrides,
  };
}

describe("chaosStore", () => {
  beforeEach(() => {
    useChaosStore.getState().reset();
  });

  it("initial state has empty events", () => {
    const state = useChaosStore.getState();
    expect(state.activeEvents).toEqual([]);
    expect(state.activeNodeIds).toEqual([]);
    expect(state.showChaosPanel).toBe(false);
    expect(state.lastChaosInjectionAt).toBe(0);
  });

  it("addActiveEvent adds an event and its nodeId", () => {
    useChaosStore.getState().addActiveEvent(makeEvent());
    const state = useChaosStore.getState();
    expect(state.activeEvents).toHaveLength(1);
    expect(state.activeNodeIds).toEqual(["node-1"]);
  });

  it("addActiveEvent deduplicates nodeIds", () => {
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-1", nodeId: "node-1" }));
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-2", nodeId: "node-1" }));
    const state = useChaosStore.getState();
    expect(state.activeEvents).toHaveLength(2);
    expect(state.activeNodeIds).toEqual(["node-1"]);
  });

  it("addActiveEvent accumulates multiple nodeIds", () => {
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-1", nodeId: "node-1" }));
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-2", nodeId: "node-2" }));
    const state = useChaosStore.getState();
    expect(state.activeEvents).toHaveLength(2);
    expect(state.activeNodeIds).toEqual(["node-1", "node-2"]);
  });

  it("removeActiveEvent removes event and recalculates nodeIds", () => {
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-1", nodeId: "node-1" }));
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-2", nodeId: "node-2" }));
    useChaosStore.getState().removeActiveEvent("ev-1");
    const state = useChaosStore.getState();
    expect(state.activeEvents).toHaveLength(1);
    expect(state.activeEvents[0].id).toBe("ev-2");
    expect(state.activeNodeIds).toEqual(["node-2"]);
  });

  it("setActiveEvents replaces events and recalculates nodeIds", () => {
    useChaosStore.getState().addActiveEvent(makeEvent({ id: "ev-1", nodeId: "node-1" }));
    useChaosStore.getState().setActiveEvents([
      makeEvent({ id: "ev-2", nodeId: "node-2" }),
      makeEvent({ id: "ev-3", nodeId: "node-3" }),
    ]);
    const state = useChaosStore.getState();
    expect(state.activeEvents).toHaveLength(2);
    expect(state.activeNodeIds).toEqual(["node-2", "node-3"]);
  });

  it("setShowChaosPanel toggles panel visibility", () => {
    useChaosStore.getState().setShowChaosPanel(true);
    expect(useChaosStore.getState().showChaosPanel).toBe(true);
    useChaosStore.getState().setShowChaosPanel(false);
    expect(useChaosStore.getState().showChaosPanel).toBe(false);
  });

  it("setLastChaosInjectionAt stores timestamp", () => {
    const now = Date.now();
    useChaosStore.getState().setLastChaosInjectionAt(now);
    expect(useChaosStore.getState().lastChaosInjectionAt).toBe(now);
  });

  it("reset clears all state", () => {
    useChaosStore.getState().addActiveEvent(makeEvent());
    useChaosStore.getState().setShowChaosPanel(true);
    useChaosStore.getState().setLastChaosInjectionAt(Date.now());
    useChaosStore.getState().reset();
    const state = useChaosStore.getState();
    expect(state.activeEvents).toEqual([]);
    expect(state.activeNodeIds).toEqual([]);
    expect(state.showChaosPanel).toBe(false);
    expect(state.lastChaosInjectionAt).toBe(0);
  });
});

describe("CHAOS_TYPES definitions", () => {
  it("has 8 chaos types", () => {
    expect(CHAOS_TYPES).toHaveLength(8);
  });

  it("each type has required fields", () => {
    for (const def of CHAOS_TYPES) {
      expect(def.type).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(def.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("includes NodeFailure", () => {
    const nf = CHAOS_TYPES.find((d) => d.type === "NodeFailure");
    expect(nf).toBeDefined();
    expect(nf?.label).toBe("Node Failure");
  });

  it("includes SplitBrain is NOT in the frontend list (not in CHAOS_TYPES)", () => {
    const sb = CHAOS_TYPES.find((d) => d.type === "SplitBrain");
    expect(sb).toBeUndefined();
  });
});
