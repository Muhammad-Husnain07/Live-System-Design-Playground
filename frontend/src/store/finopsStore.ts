import { create } from "zustand";

export interface CostLineItem {
  service: string;
  description: string;
  unitPrice: number;
  quantity: number;
  monthlyCost: number;
}

export interface CostCategory {
  category: string;
  items: CostLineItem[];
  subtotal: number;
}

export interface CostEstimate {
  userTier: string;
  monthlyUsers: number;
  multiplier: number;
  totalMonthlyCost: number;
  breakdown: CostCategory[];
  dataEgressTotal?: number;
}

export interface Recommendation {
  title: string;
  description: string;
  potentialSavings: number;
  annualSavings: number;
  effort: string;
}

export interface CostReport {
  projectId: string;
  monthlyUsers: number;
  currentEstimate: CostEstimate;
  scalingProjections: CostEstimate[];
  recommendations: Recommendation[];
  generatedAt: string;
}

interface FinOpsNodeCost {
  nodeId: string;
  label: string;
  monthlyCost: number;
}

interface FinOpsState {
  showPanel: boolean;
  setShowPanel: (v: boolean) => void;
  estimate: CostReport | null;
  setEstimate: (e: CostReport | null) => void;
  nodeCosts: FinOpsNodeCost[];
  setNodeCosts: (costs: FinOpsNodeCost[]) => void;
}

export const useFinOpsStore = create<FinOpsState>((set) => ({
  showPanel: false,
  setShowPanel: (v) => set({ showPanel: v }),
  estimate: null,
  setEstimate: (e) => set({ estimate: e }),
  nodeCosts: [],
  setNodeCosts: (c) => set({ nodeCosts: c }),
}));
