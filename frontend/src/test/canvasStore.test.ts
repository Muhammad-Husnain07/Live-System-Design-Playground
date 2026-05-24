import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import type { Node } from "reactflow";

function makeNode(id: string, overrides?: Record<string, any>): Node {
  return {
    id,
    type: "default",
    position: { x: 0, y: 0 },
    data: {
      nodeType: "WebServer",
      label: "Web",
      config: {
        instances: 2,
        maxRPS: 4000,
        latencyMs: 20,
        errorRate: 0.01,
        isFailed: false,
        isBottleneck: false,
        region: "us-east-1",
        deployment: { strategy: "rolling", canaryPercent: 10, canaryVersion: "", isCanaryActive: false },
        security: { isPublicFacing: true, requiresTLS: true, allowedInbound: [], vpcId: "" },
      },
      metrics: {
        currentRPS: 0,
        cpuPercent: 0,
        memoryPercent: 0,
        queueDepth: 0,
        errorCount: 0,
        p99LatencyMs: 0,
        canaryRPS: 0,
        errorRate: 0,
      },
      ...overrides,
    },
  };
}

describe("canvasStore.clearSimulationMetrics", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      isSimulationRunning: true,
      isDirty: false,
      lastSaved: "2026-01-01T00:00:00Z",
    });
  });

  it("strips metrics from node data", () => {
    const node = makeNode("n1");
    useCanvasStore.setState({ nodes: [node] });
    useCanvasStore.getState().clearSimulationMetrics();
    const cleaned = useCanvasStore.getState().nodes[0];
    expect(cleaned.data).not.toHaveProperty("metrics");
  });

  it("strips isBottleneck and isFailed from config", () => {
    const node = makeNode("n1", {
      config: { instances: 3, maxRPS: 5000, isBottleneck: true, isFailed: true },
    });
    useCanvasStore.setState({ nodes: [node] });
    useCanvasStore.getState().clearSimulationMetrics();
    const config = useCanvasStore.getState().nodes[0].data.config;
    expect(config).not.toHaveProperty("isBottleneck");
    expect(config).not.toHaveProperty("isFailed");
  });

  it("preserves other config fields (instances, maxRPS, latencyMs, errorRate)", () => {
    const node = makeNode("n1");
    useCanvasStore.setState({ nodes: [node] });
    useCanvasStore.getState().clearSimulationMetrics();
    const config = useCanvasStore.getState().nodes[0].data.config;
    expect(config.instances).toBe(2);
    expect(config.maxRPS).toBe(4000);
    expect(config.latencyMs).toBe(20);
    expect(config.errorRate).toBe(0.01);
  });

  it("preserves deployment and security config", () => {
    const node = makeNode("n1");
    useCanvasStore.setState({ nodes: [node] });
    useCanvasStore.getState().clearSimulationMetrics();
    const config = useCanvasStore.getState().nodes[0].data.config;
    expect(config.deployment).toBeDefined();
    expect(config.deployment.strategy).toBe("rolling");
    expect(config.security).toBeDefined();
    expect(config.security.isPublicFacing).toBe(true);
  });

  it("sets isDirty to true", () => {
    useCanvasStore.setState({ nodes: [makeNode("n1")], isDirty: false });
    useCanvasStore.getState().clearSimulationMetrics();
    expect(useCanvasStore.getState().isDirty).toBe(true);
  });

  it("sets isSimulationRunning to false", () => {
    useCanvasStore.setState({ nodes: [makeNode("n1")], isSimulationRunning: true });
    useCanvasStore.getState().clearSimulationMetrics();
    expect(useCanvasStore.getState().isSimulationRunning).toBe(false);
  });

  it("handles nodes without config gracefully", () => {
    const node = { id: "n1", type: "default", position: { x: 0, y: 0 }, data: { nodeType: "WebServer", label: "Web" } };
    useCanvasStore.setState({ nodes: [node as unknown as Node] });
    expect(() => useCanvasStore.getState().clearSimulationMetrics()).not.toThrow();
  });

  it("handles empty node list", () => {
    useCanvasStore.setState({ nodes: [] });
    expect(() => useCanvasStore.getState().clearSimulationMetrics()).not.toThrow();
    expect(useCanvasStore.getState().nodes).toEqual([]);
  });
});
