import { create } from "zustand";
import api, { getErrorMessage } from "../utils/api";
import { useToastStore } from "./toastStore";

export interface NodeSLOStatus {
  nodeId: string;
  label: string;
  sloTargetMs: number;
  sloAvailabilityTarget: number;
  actualLatencyMs: number;
  actualErrorRate: number;
  latencyBudgetRemainingPercent: number;
  availabilityBudgetRemainingPercent: number;
  burnRate: number;
  status: "healthy" | "slow_burn" | "fast_burn";
}

export interface SLOReport {
  windowSeconds: number;
  nodes: NodeSLOStatus[];
}

interface SLOStore {
  sloReport: SLOReport | null;
  loading: boolean;
  alertedBudgetExhausted: string[];
  fetchSLOReport: (simId: string) => Promise<void>;
  clearSLOData: () => void;
}

export const useSLOStore = create<SLOStore>((set) => ({
  sloReport: null,
  loading: false,
  alertedBudgetExhausted: [],
  fetchSLOReport: async (simId) => {
    set({ loading: true });
    try {
      const res = await api.get(`/simulations/${simId}/slo-report`);
      set({ sloReport: res.data, loading: false });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to fetch SLO report.");
      set({ loading: false });
      useToastStore.getState().addToast({ type: "error", title: "SLO fetch failed", message: msg, duration: 5000 });
    }
  },
  clearSLOData: () => set({ sloReport: null, alertedBudgetExhausted: [] }),
}));
