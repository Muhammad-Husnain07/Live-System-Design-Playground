import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import type { Node, Edge } from "reactflow";

function makeNode(id: string, overrides?: Record<string, any>): Node {
  return {
    id,
    type: "default",
    position: { x: 100, y: 100 },
    data: {
      nodeType: "WebServer",
      label: "Web Server",
      config: {
        instances: 3, maxRPS: 2000, latencyMs: 20, errorRate: 0.01,
        isFailed: false, isBottleneck: false,
        region: "us-east-1",
        deployment: { strategy: "rolling", canaryPercent: 10, canaryVersion: "", isCanaryActive: false },
        security: { isPublicFacing: false, requiresTLS: false, allowedInbound: [], vpcId: "" },
        cacheHitRatio: 0, connectionPoolMax: 10, coldStartMs: 0, diskIOPSMax: 0,
        isPrimaryDB: false, autoScaling: { enabled: false, minInstances: 1, maxInstances: 3, targetCPUPercent: 80, targetMemPercent: 80, cooldownTicks: 60, scaleUpFactor: 2, scaleDownFactor: 0.5 },
        replicationRole: "", replicationLagMs: 0, computeTier: "on_demand" as const, permissions: "",
        dimensions: 0, indexType: "", topK: 0, tokensPerSecond: 0, promptTokenCount: 0,
        completionTokenCount: 0, vramGB: 0, modelSizeGB: 0, cudaUtilization: 0,
        geographicLatencyModifier: 1, snapStartEnabled: false,
      },
      metrics: {
        currentRPS: 0, cpuPercent: 0, memoryPercent: 0, queueDepth: 0,
        errorCount: 0, p99LatencyMs: 0, canaryRPS: 0, errorRate: 0,
        retryCount: 0, droppedRequests: 0, cacheHitRatio: 0, connectionPoolMax: 10,
        coldStartMs: 0, diskIOPSMax: 0, isPrimaryDB: false, activeConnections: 0,
        desiredInstances: 0, scalingEvent: "", staleReadCount: 0, isSplitBrain: false,
        dataInconsistency: 0, spotInterrupted: false,
        dimensions: 0, indexType: "", topK: 0, tokensPerSecond: 0, promptTokenCount: 0,
        completionTokenCount: 0, vramGB: 0, modelSizeGB: 0, cudaUtilization: 0,
        geographicLatencyModifier: 1, snapStartEnabled: false,
      },
      simulationState: { status: "healthy" as const, uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
      ...overrides,
    },
  };
}

function makeEdge(id: string, source: string, target: string, overrides?: Record<string, any>): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    data: {
      routing: { protocol: "HTTP", isSync: true, trafficPercent: 100, requiresTLS: false, authRequired: false, packetLoss: 0, jitterMs: 0 },
      throughputRPS: 0, latencyMs: 0, isAnimated: false, isSaturated: false, isSecure: true,
      ...overrides,
    },
  };
}

describe("canvasStore node/edge operations", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: false,
      lastSaved: null,
      pastStates: [],
      futureStates: [],
      isSimulationRunning: false,
    });
  });

  describe("addNode", () => {
    it("adds a node and marks dirty", () => {
      const node = makeNode("n1");
      useCanvasStore.getState().addNode(node);
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().nodes[0].id).toBe("n1");
      expect(useCanvasStore.getState().isDirty).toBe(true);
    });

    it("creates undo state", () => {
      const node = makeNode("n1");
      useCanvasStore.getState().addNode(node);
      expect(useCanvasStore.getState().pastStates).toHaveLength(1);
    });

    it("clears future states", () => {
      useCanvasStore.setState({ futureStates: [{ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }] });
      const node = makeNode("n1");
      useCanvasStore.getState().addNode(node);
      expect(useCanvasStore.getState().futureStates).toHaveLength(0);
    });

    it("assigns node with defaults from NODE_REGISTRY via ComponentSpawner", () => {
      // Simulate what ComponentSpawner does
      const nodeType = "LoadBalancer";
      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: "loadBalancer",
        position: { x: 300, y: 200 },
        style: { width: 220, height: 120 },
        data: {
          nodeType,
          label: "Load Balancer",
          config: { instances: 2, region: "us-east-1", maxRPS: 10000, latencyMs: 5, errorRate: 0.01, isFailed: false, isBottleneck: false },
          simulationState: { status: "healthy" as const, uptimeSeconds: 0, lastFailure: null, failureCount: 0 },
          metrics: { currentRPS: 0, cpuPercent: 0, memoryPercent: 0 },
        },
      };
      useCanvasStore.getState().addNode(newNode);
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().nodes[0].type).toBe("loadBalancer");
      expect(useCanvasStore.getState().nodes[0].data.nodeType).toBe("LoadBalancer");
    });
  });

  describe("removeNode", () => {
    it("removes a node and its connected edges", () => {
      useCanvasStore.setState({
        nodes: [makeNode("n1"), makeNode("n2")],
        edges: [makeEdge("e1", "n1", "n2")],
      });
      useCanvasStore.getState().removeNode("n1");
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().nodes[0].id).toBe("n2");
      expect(useCanvasStore.getState().edges).toHaveLength(0);
    });

    it("clears selection when removing selected node", () => {
      useCanvasStore.setState({
        nodes: [makeNode("n1")],
        selectedNodeId: "n1",
      });
      useCanvasStore.getState().removeNode("n1");
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });

    it("creates undo state", () => {
      useCanvasStore.setState({ nodes: [makeNode("n1")] });
      useCanvasStore.getState().removeNode("n1");
      expect(useCanvasStore.getState().pastStates).toHaveLength(1);
    });
  });

  describe("addEdge", () => {
    it("adds an edge with default routing data", () => {
      useCanvasStore.setState({ nodes: [makeNode("n1"), makeNode("n2")] });
      const edge = makeEdge("n1->n2", "n1", "n2");
      useCanvasStore.getState().addEdge(edge);
      expect(useCanvasStore.getState().edges).toHaveLength(1);
      expect(useCanvasStore.getState().isDirty).toBe(true);
    });
  });

  describe("undo/redo", () => {
    it("undoes a node add", () => {
      useCanvasStore.getState().addNode(makeNode("n1"));
      expect(useCanvasStore.getState().nodes).toHaveLength(1);

      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(0);
      expect(useCanvasStore.getState().isDirty).toBe(true);
    });

    it("redoes after undo", () => {
      useCanvasStore.getState().addNode(makeNode("n1"));
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(0);

      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
    });

    it("limits undo stack to 50", () => {
      for (let i = 0; i < 60; i++) {
        useCanvasStore.getState().addNode(makeNode(`n${i}`));
      }
      expect(useCanvasStore.getState().pastStates.length).toBeLessThanOrEqual(50);
      expect(useCanvasStore.getState().nodes).toHaveLength(60);
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(59);
    });

    it("does nothing when no undo states", () => {
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(0);
    });

    it("does nothing when no redo states", () => {
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().nodes).toHaveLength(0);
    });
  });

  describe("loadTemplate", () => {
    it("adds multiple nodes and edges atomically", () => {
      const tNodes = [makeNode("t1"), makeNode("t2")];
      const tEdges = [makeEdge("t1->t2", "t1", "t2")];
      useCanvasStore.getState().loadTemplate(tNodes, tEdges);
      expect(useCanvasStore.getState().nodes).toHaveLength(2);
      expect(useCanvasStore.getState().edges).toHaveLength(1);
      expect(useCanvasStore.getState().pastStates).toHaveLength(1);
    });
  });

  describe("isDirty tracking", () => {
    it("marks dirty on node add, clears on markSaved", () => {
      expect(useCanvasStore.getState().isDirty).toBe(false);
      useCanvasStore.getState().addNode(makeNode("n1"));
      expect(useCanvasStore.getState().isDirty).toBe(true);
      useCanvasStore.getState().markSaved("2026-01-01T00:00:00Z");
      expect(useCanvasStore.getState().isDirty).toBe(false);
      expect(useCanvasStore.getState().lastSaved).toBe("2026-01-01T00:00:00Z");
    });

    it("marks dirty on edge add", () => {
      useCanvasStore.setState({ nodes: [makeNode("n1"), makeNode("n2")], isDirty: false });
      useCanvasStore.getState().addEdge(makeEdge("e1", "n1", "n2"));
      expect(useCanvasStore.getState().isDirty).toBe(true);
    });
  });

  describe("selection state", () => {
    it("selectNode clears edge selection", () => {
      useCanvasStore.setState({ selectedEdgeId: "e1" });
      useCanvasStore.getState().selectNode("n1");
      expect(useCanvasStore.getState().selectedNodeId).toBe("n1");
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it("selectEdge clears node selection", () => {
      useCanvasStore.setState({ selectedNodeId: "n1" });
      useCanvasStore.getState().selectEdge("e1");
      expect(useCanvasStore.getState().selectedEdgeId).toBe("e1");
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });

    it("selectNode(null) preserves edge selection", () => {
      useCanvasStore.setState({ selectedNodeId: "n1", selectedEdgeId: "e1" });
      useCanvasStore.getState().selectNode(null);
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
      // selectNode(null) only clears node selection; onPaneClick also calls selectEdge(null)
      expect(useCanvasStore.getState().selectedEdgeId).toBe("e1");
    });
  });

  describe("resizeNode", () => {
    it("updates node style dimensions", () => {
      const node = makeNode("n1");
      useCanvasStore.setState({ nodes: [node] });
      useCanvasStore.getState().resizeNode("n1", 300, 200);
      expect(useCanvasStore.getState().nodes[0].style?.width).toBe(300);
      expect(useCanvasStore.getState().nodes[0].style?.height).toBe(200);
    });
  });

  describe("updateNodeConfig", () => {
    it("merges config fields", () => {
      const node = makeNode("n1");
      useCanvasStore.setState({ nodes: [node] });
      useCanvasStore.getState().updateNodeConfig("n1", { instances: 5, region: "eu-west-1" });
      expect(useCanvasStore.getState().nodes[0].data.config.instances).toBe(5);
      expect(useCanvasStore.getState().nodes[0].data.config.region).toBe("eu-west-1");
      // Preserves other fields
      expect(useCanvasStore.getState().nodes[0].data.config.maxRPS).toBe(2000);
    });
  });

  describe("updateNodeData", () => {
    it("merges top-level data fields", () => {
      const node = makeNode("n1");
      useCanvasStore.setState({ nodes: [node] });
      useCanvasStore.getState().updateNodeData("n1", { label: "Updated Label" });
      expect(useCanvasStore.getState().nodes[0].data.label).toBe("Updated Label");
    });
  });
});
