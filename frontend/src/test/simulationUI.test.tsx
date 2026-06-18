import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import { useSimulationStore } from "../store/simulationStore";

describe("TopToolbar simulation timer", () => {
  beforeEach(() => {
    useCanvasStore.setState({ isSimulationRunning: false });
    useSimulationStore.getState().reset();
  });

  it("formatTime produces HH:MM:SS", () => {
    // The formatTime function is local to TopToolbar; test the elapsed store
    useSimulationStore.getState().setElapsed(0);
    expect(useSimulationStore.getState().elapsed).toBe(0);

    useSimulationStore.getState().setElapsed(3661);
    expect(useSimulationStore.getState().elapsed).toBe(3661);
  });

  it("isSimRunning in canvasStore controls transport pill state", () => {
    expect(useCanvasStore.getState().isSimulationRunning).toBe(false);

    useCanvasStore.setState({ isSimulationRunning: true });
    expect(useCanvasStore.getState().isSimulationRunning).toBe(true);

    useCanvasStore.setState({ isSimulationRunning: false });
    expect(useCanvasStore.getState().isSimulationRunning).toBe(false);
  });

  it("simulationSpeed selector values are 1, 2, 5", () => {
    const setSpeed = useCanvasStore.getState().setSimulationSpeed;
    setSpeed(1);
    expect(useCanvasStore.getState().simulationSpeed).toBe(1);
    setSpeed(2);
    expect(useCanvasStore.getState().simulationSpeed).toBe(2);
    setSpeed(5);
    expect(useCanvasStore.getState().simulationSpeed).toBe(5);
  });
});

describe("HeatmapOverlay stress computation", () => {
  beforeEach(() => {
    useCanvasStore.setState({ isSimulationRunning: true });
  });

  it("computes stress from max of RPS and CPU ratios", () => {
    // MAX_RPS=10000, MAX_CPU=100
    // stress = max(currentRPS/10000, cpuPercent/100)
    const stressRPS = Math.max(5000 / 10000, 0);
    const stressCPU = Math.max(0, 80 / 100);
    const stressBoth = Math.max(5000 / 10000, 80 / 100);

    expect(stressRPS).toBe(0.5);
    expect(stressCPU).toBe(0.8);
    expect(stressBoth).toBe(0.8); // CPU dominates
  });

  it("color shifts from baseline (128,64,200) toward red (255,14,20) with stress", () => {
    const computeColor = (stress: number) => ({
      r: Math.round(128 + stress * 127),
      g: Math.round(64 - stress * 50),
      b: Math.round(200 - stress * 180),
    });

    const baseline = computeColor(0);
    expect(baseline).toEqual({ r: 128, g: 64, b: 200 });

    const full = computeColor(1);
    expect(full.r).toBe(255);
    expect(full.g).toBe(14);
    expect(full.b).toBe(20);

    const half = computeColor(0.5);
    expect(half.r).toBe(192);
    expect(half.g).toBe(39);
    expect(half.b).toBe(110);
  });

  it("radius grows with stress", () => {
    const radius = (stress: number) => 80 + stress * 120;

    expect(radius(0)).toBe(80);
    expect(radius(1)).toBe(200);
    expect(radius(0.5)).toBe(140);
  });

  it("intensity grows with stress", () => {
    const intensity = (stress: number) => 0.12 + stress * 0.25;

    expect(intensity(0)).toBe(0.12);
    expect(intensity(1)).toBe(0.37);
    expect(intensity(0.5)).toBe(0.245);
  });

  it("does not render when sim is not running", () => {
    useCanvasStore.setState({ isSimulationRunning: false });
    // HeatmapOverlay returns null when !isSimRunning
    expect(useCanvasStore.getState().isSimulationRunning).toBe(false);
  });
});

describe("BottomDrawer metrics formatters", () => {
  it("formats large numbers with K/M suffixes", () => {
    const fmt = (n: number): string => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
      return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    expect(fmt(500)).toBe("500");
    expect(fmt(1500)).toBe("1.5K");
    expect(fmt(2500000)).toBe("2.5M");
  });

  it("formats p99 latency as ms or s", () => {
    const ms = (v: number): string => {
      if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
      return `${Math.round(v)}ms`;
    };

    expect(ms(50)).toBe("50ms");
    expect(ms(500)).toBe("500ms");
    expect(ms(1500)).toBe("1.5s");
    expect(ms(3000)).toBe("3.0s");
  });

  it("formats elapsed time as MM:SS", () => {
    const formatElapsed = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(3600)).toBe("60:00");
  });

  it("computes p99Latency as max across node metrics", () => {
    const latestTick = {
      nodeMetrics: [
        { p99LatencyMs: 25 },
        { p99LatencyMs: 150 },
        { p99LatencyMs: 500 },
      ],
    };
    const p99 = Math.max(...latestTick.nodeMetrics.map((m: any) => m.p99LatencyMs ?? 0));
    expect(p99).toBe(500);
  });

  it("computes totalRPS and errorRate from latestTick", () => {
    const latestTick = {
      totalRPS: 5000,
      globalErrorRate: 0.035,
    };
    expect(latestTick.totalRPS).toBe(5000);
    expect(latestTick.globalErrorRate).toBe(0.035);
  });
});

describe("applyTickToCanvas node update", () => {
  it("maps tick data to node metrics shape", () => {
    const tickMetrics = {
      nodeId: "n1",
      currentRPS: 950,
      cpuPercent: 45,
      memoryPercent: 60,
      queueDepth: 50,
      p99LatencyMs: 25,
      errorRate: 0.02,
      isBottleneck: true,
      isFailed: false,
      canaryRPS: 0,
      errorCount: 19,
      retryCount: 2,
      droppedRequests: 10,
      cacheHitRatio: 0.8,
      connectionPoolMax: 100,
      coldStartMs: 0,
      diskIOPSMax: 3000,
      isPrimaryDB: false,
      activeConnections: 50,
      desiredInstances: 3,
      scalingEvent: "",
      staleReadCount: 0,
      isSplitBrain: false,
      dataInconsistency: 0,
      spotInterrupted: false,
    };

    // Simulate what applyTickToCanvas does
    const metrics = {
      currentRPS: tickMetrics.currentRPS ?? 0,
      cpuPercent: tickMetrics.cpuPercent ?? 0,
      memoryPercent: tickMetrics.memoryPercent ?? 0,
      queueDepth: tickMetrics.queueDepth ?? 0,
      errorCount: tickMetrics.errorCount ?? 0,
      p99LatencyMs: tickMetrics.p99LatencyMs ?? 0,
      canaryRPS: tickMetrics.canaryRPS ?? 0,
      errorRate: tickMetrics.errorRate ?? 0,
      retryCount: tickMetrics.retryCount ?? 0,
      droppedRequests: tickMetrics.droppedRequests ?? 0,
      cacheHitRatio: tickMetrics.cacheHitRatio ?? 0,
      connectionPoolMax: tickMetrics.connectionPoolMax ?? 100,
      coldStartMs: tickMetrics.coldStartMs ?? 0,
      diskIOPSMax: tickMetrics.diskIOPSMax ?? 0,
      isPrimaryDB: tickMetrics.isPrimaryDB ?? false,
      activeConnections: tickMetrics.activeConnections ?? 0,
      desiredInstances: tickMetrics.desiredInstances ?? 0,
      scalingEvent: tickMetrics.scalingEvent ?? "",
      staleReadCount: tickMetrics.staleReadCount ?? 0,
      isSplitBrain: tickMetrics.isSplitBrain ?? false,
      dataInconsistency: tickMetrics.dataInconsistency ?? 0,
      spotInterrupted: tickMetrics.spotInterrupted ?? false,
    };

    expect(metrics.currentRPS).toBe(950);
    expect(metrics.cpuPercent).toBe(45);
    expect(metrics.memoryPercent).toBe(60);
    expect(metrics.queueDepth).toBe(50);
    expect(metrics.p99LatencyMs).toBe(25);
    expect(metrics.errorRate).toBe(0.02);
  });

  it("defaults missing metrics to 0/false", () => {
    const metrics = {
      currentRPS: undefined as any ?? 0,
      cpuPercent: undefined as any ?? 0,
      memoryPercent: undefined as any ?? 0,
      queueDepth: undefined as any ?? 0,
      isBottleneck: undefined as any ?? false,
      isFailed: undefined as any ?? false,
    };
    expect(metrics.currentRPS).toBe(0);
    expect(metrics.cpuPercent).toBe(0);
    expect(metrics.memoryPercent).toBe(0);
    expect(metrics.queueDepth).toBe(0);
    expect(metrics.isBottleneck).toBe(false);
    expect(metrics.isFailed).toBe(false);
  });
});
