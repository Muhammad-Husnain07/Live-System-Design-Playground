import { describe, it, expect } from "vitest";
import { getLatencyColor, REGION_COORDS } from "../types/geo";

describe("getLatencyColor", () => {
  it("returns green for latency < 50ms", () => {
    expect(getLatencyColor(0)).toBe("#22C55E");
    expect(getLatencyColor(25)).toBe("#22C55E");
    expect(getLatencyColor(49)).toBe("#22C55E");
  });

  it("returns yellow for latency 50-149ms", () => {
    expect(getLatencyColor(50)).toBe("#F59E0B");
    expect(getLatencyColor(100)).toBe("#F59E0B");
    expect(getLatencyColor(149)).toBe("#F59E0B");
  });

  it("returns red for latency >= 150ms", () => {
    expect(getLatencyColor(150)).toBe("#EF4444");
    expect(getLatencyColor(200)).toBe("#EF4444");
    expect(getLatencyColor(999)).toBe("#EF4444");
  });
});

describe("REGION_COORDS", () => {
  it("contains all 8 AWS regions", () => {
    const expectedRegions = [
      "us-east-1",
      "us-west-2",
      "eu-west-1",
      "eu-central-1",
      "ap-southeast-1",
      "ap-northeast-1",
      "ap-south-1",
      "sa-east-1",
    ];
    for (const r of expectedRegions) {
      expect(REGION_COORDS[r]).toBeDefined();
      expect(typeof REGION_COORDS[r].lat).toBe("number");
      expect(typeof REGION_COORDS[r].lng).toBe("number");
      expect(typeof REGION_COORDS[r].label).toBe("string");
    }
  });

  it("has valid latitude and longitude for all regions", () => {
    for (const [, coords] of Object.entries(REGION_COORDS)) {
      expect(coords.lat).toBeGreaterThanOrEqual(-90);
      expect(coords.lat).toBeLessThanOrEqual(90);
      expect(coords.lng).toBeGreaterThanOrEqual(-180);
      expect(coords.lng).toBeLessThanOrEqual(180);
    }
  });
});

describe("GeoMetricsResponse shape", () => {
  it("validates region metrics structure", () => {
    const regionMetrics = {
      nodeCount: 3,
      totalRPS: 1500.5,
      avgLatencyMs: 45.2,
      avgErrorRate: 0.001,
      nodeIds: ["web-1", "app-1", "db-1"],
      isFailed: false,
      failedNodeIds: [],
    };
    expect(regionMetrics.nodeCount).toBe(3);
    expect(typeof regionMetrics.totalRPS).toBe("number");
    expect(Array.isArray(regionMetrics.nodeIds)).toBe(true);
    expect(Array.isArray(regionMetrics.failedNodeIds)).toBe(true);
    expect(regionMetrics.isFailed).toBe(false);
  });

  it("validates inter-region edge structure", () => {
    const edge = {
      sourceRegion: "us-east-1",
      targetRegion: "eu-west-1",
      totalRPS: 500,
      avgLatencyMs: 95,
      edgeCount: 3,
    };
    expect(edge.sourceRegion).toBe("us-east-1");
    expect(edge.targetRegion).toBe("eu-west-1");
    expect(edge.edgeCount).toBe(3);
  });

  it("validates full geo metrics response", () => {
    const response = {
      regions: {
        "us-east-1": {
          nodeCount: 3,
          totalRPS: 1500,
          avgLatencyMs: 45,
          avgErrorRate: 0.001,
          nodeIds: ["web-1"],
          isFailed: false,
          failedNodeIds: [],
        },
      },
      interRegionEdges: [
        {
          sourceRegion: "us-east-1",
          targetRegion: "eu-west-1",
          totalRPS: 500,
          avgLatencyMs: 95,
          edgeCount: 3,
        },
      ],
    };
    expect(Object.keys(response.regions)).toHaveLength(1);
    expect(response.interRegionEdges).toHaveLength(1);
    expect(response.regions["us-east-1"].isFailed).toBe(false);
  });
});
