import { describe, it, expect, beforeEach } from "vitest";
import { useSimulationStore } from "../store/simulationStore";
import type { TickData } from "../store/simulationStore";

function makeTick(overrides?: Partial<TickData>): TickData {
  return {
    tickNumber: 1,
    timestamp: "2026-01-01T00:00:00Z",
    nodeMetrics: [
      {
        nodeId: "n1",
        nodeType: "WebServer",
        label: "Web Server",
        incomingRPS: 1000,
        currentRPS: 950,
        canaryRPS: 0,
        maxRPS: 5000,
        instances: 3,
        latencyMs: 10,
        errorRate: 0.02,
        queueDepth: 50,
        isBottleneck: false,
        overflowRPS: 0,
        cpuPercent: 45,
        memoryPercent: 60,
        errorCount: 19,
        p99LatencyMs: 25,
        isFailed: false,
        isAsync: false,
        retryCount: 2,
        droppedRequests: 10,
        cacheHitRatio: 0,
        connectionPoolMax: 100,
        coldStartMs: 0,
        diskIOPSMax: 3000,
        isPrimaryDB: false,
        activeConnections: 50,
        desiredInstances: 3,
        scalingEvent: "",
        computeTier: "on_demand",
        replicationRole: "",
        replicationLagMs: 0,
        staleReadCount: 0,
        isSplitBrain: false,
        dataInconsistency: 0,
        spotInterrupted: false,
      },
    ],
    totalRPS: 950,
    globalErrorRate: 0.02,
    activeRequests: 100,
    ...overrides,
  };
}

describe("simulationStore", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with isRunning=false, no ticks, disconnected", () => {
      const s = useSimulationStore.getState();
      expect(s.isRunning).toBe(false);
      expect(s.ticks).toEqual([]);
      expect(s.latestTick).toBeNull();
      expect(s.connectionStatus).toBe("disconnected");
      expect(s.elapsed).toBe(0);
      expect(s.runId).toBeNull();
    });

    it("has default config", () => {
      const s = useSimulationStore.getState();
      expect(s.config.targetRPS).toBe(2000);
      expect(s.config.durationSeconds).toBe(60);
      expect(s.config.speedMultiplier).toBe(1);
      expect(s.config.trafficPattern).toBe("steady");
    });
  });

  describe("setRunning", () => {
    it("toggles running state", () => {
      useSimulationStore.getState().setRunning(true);
      expect(useSimulationStore.getState().isRunning).toBe(true);
      useSimulationStore.getState().setRunning(false);
      expect(useSimulationStore.getState().isRunning).toBe(false);
    });
  });

  describe("setRunId", () => {
    it("stores simulation run ID", () => {
      useSimulationStore.getState().setRunId("sim-123");
      expect(useSimulationStore.getState().runId).toBe("sim-123");
    });

    it("clears run ID when null", () => {
      useSimulationStore.getState().setRunId("sim-123");
      useSimulationStore.getState().setRunId(null);
      expect(useSimulationStore.getState().runId).toBeNull();
    });
  });

  describe("setConnectionStatus", () => {
    it("updates connection status", () => {
      useSimulationStore.getState().setConnectionStatus("connecting");
      expect(useSimulationStore.getState().connectionStatus).toBe("connecting");

      useSimulationStore.getState().setConnectionStatus("connected");
      expect(useSimulationStore.getState().connectionStatus).toBe("connected");

      useSimulationStore.getState().setConnectionStatus("error");
      expect(useSimulationStore.getState().connectionStatus).toBe("error");
    });
  });

  describe("setElapsed", () => {
    it("tracks elapsed seconds", () => {
      useSimulationStore.getState().setElapsed(10);
      expect(useSimulationStore.getState().elapsed).toBe(10);
    });
  });

  describe("appendTicks", () => {
    it("appends ticks in order", () => {
      const tick1 = makeTick({ tickNumber: 1 });
      const tick2 = makeTick({ tickNumber: 2, totalRPS: 1200 });

      useSimulationStore.getState().appendTicks([tick1]);
      expect(useSimulationStore.getState().ticks).toHaveLength(1);
      expect(useSimulationStore.getState().latestTick?.tickNumber).toBe(1);

      useSimulationStore.getState().appendTicks([tick2]);
      expect(useSimulationStore.getState().ticks).toHaveLength(2);
      expect(useSimulationStore.getState().latestTick?.tickNumber).toBe(2);
      expect(useSimulationStore.getState().latestTick?.totalRPS).toBe(1200);
    });

    it("batches multiple ticks in single append", () => {
      const batch = [makeTick({ tickNumber: 1 }), makeTick({ tickNumber: 2 }), makeTick({ tickNumber: 3 })];
      useSimulationStore.getState().appendTicks(batch);
      expect(useSimulationStore.getState().ticks).toHaveLength(3);
      expect(useSimulationStore.getState().latestTick?.tickNumber).toBe(3);
    });

    it("caps at 5000 ticks", () => {
      const manyTicks = Array.from({ length: 6000 }, (_, i) => makeTick({ tickNumber: i }));
      useSimulationStore.getState().appendTicks(manyTicks);
      expect(useSimulationStore.getState().ticks.length).toBeLessThanOrEqual(5000);
    });
  });

  describe("onTick", () => {
    it("appends a single tick and updates latestTick", () => {
      const tick = makeTick({ tickNumber: 5 });
      useSimulationStore.getState().onTick(tick);
      expect(useSimulationStore.getState().ticks).toHaveLength(1);
      expect(useSimulationStore.getState().latestTick?.tickNumber).toBe(5);
    });

    it("caps at 5000 ticks via onTick", () => {
      const manyTicks = Array.from({ length: 6000 }, (_, i) => makeTick({ tickNumber: i }));
      manyTicks.forEach((t) => useSimulationStore.getState().onTick(t));
      expect(useSimulationStore.getState().ticks.length).toBeLessThanOrEqual(5000);
    });
  });

  describe("setConfig", () => {
    it("merges partial config", () => {
      useSimulationStore.getState().setConfig({ targetRPS: 5000 });
      const cfg = useSimulationStore.getState().config;
      expect(cfg.targetRPS).toBe(5000);
      expect(cfg.durationSeconds).toBe(60); // unchanged
    });
  });

  describe("reset", () => {
    it("resets all simulation state except config", () => {
      useSimulationStore.getState().setRunning(true);
      useSimulationStore.getState().setRunId("sim-123");
      useSimulationStore.getState().setConnectionStatus("connected");
      useSimulationStore.getState().setElapsed(45);
      useSimulationStore.getState().appendTicks([makeTick()]);

      useSimulationStore.getState().reset();

      const s = useSimulationStore.getState();
      expect(s.isRunning).toBe(false);
      expect(s.runId).toBeNull();
      expect(s.connectionStatus).toBe("disconnected");
      expect(s.elapsed).toBe(0);
      expect(s.ticks).toEqual([]);
      expect(s.latestTick).toBeNull();
    });
  });
});
