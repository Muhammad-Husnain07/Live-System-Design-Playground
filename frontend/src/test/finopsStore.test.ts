import { useFinOpsStore } from "../store/finopsStore";

describe("finopsStore", () => {
  beforeEach(() => {
    useFinOpsStore.setState({ showPanel: false, estimate: null, nodeCosts: [] });
  });

  it("toggles showPanel", () => {
    expect(useFinOpsStore.getState().showPanel).toBe(false);
    useFinOpsStore.getState().setShowPanel(true);
    expect(useFinOpsStore.getState().showPanel).toBe(true);
  });

  it("sets estimate", () => {
    const mockReport = {
      projectId: "proj-1",
      monthlyUsers: 1000,
      currentEstimate: { userTier: "1k", monthlyUsers: 1000, multiplier: 1, totalMonthlyCost: 100, breakdown: [] },
      scalingProjections: [],
      recommendations: [],
      generatedAt: "2026-01-01T00:00:00Z",
    };

    useFinOpsStore.getState().setEstimate(mockReport);
    expect(useFinOpsStore.getState().estimate).toEqual(mockReport);
  });

  it("sets nodeCosts", () => {
    const costs = [{ nodeId: "n1", label: "Web", monthlyCost: 50 }];
    useFinOpsStore.getState().setNodeCosts(costs);
    expect(useFinOpsStore.getState().nodeCosts).toEqual(costs);
  });
});
