import { create } from "zustand";
import api from "../utils/api";

export interface MaturityBreakdown {
  redundancy: number;
  observability: number;
  security: number;
  resilience: number;
}

export interface MaturityRecommendation {
  category: string;
  message: string;
  priority: string;
}

export interface MaturityReport {
  score: number;
  level: string;
  breakdown: MaturityBreakdown;
  recommendations: MaturityRecommendation[];
}

interface MaturityState {
  report: MaturityReport | null;
  loading: boolean;
  error: string | null;
  showModal: boolean;
  fetchMaturity: (projectId: string, simulationRunId?: string) => Promise<void>;
  setShowModal: (show: boolean) => void;
  reset: () => void;
}

export const useMaturityStore = create<MaturityState>((set) => ({
  report: null,
  loading: false,
  error: null,
  showModal: false,
  fetchMaturity: async (projectId, simulationRunId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("/sre/maturity-audit", {
        projectId,
        ...(simulationRunId ? { simulationRunId } : {}),
      });
      set({ report: res.data as MaturityReport, loading: false });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to fetch maturity report";
      set({ error: msg, loading: false });
    }
  },
  setShowModal: (show) => set({ showModal: show }),
  reset: () => set({ report: null, loading: false, error: null, showModal: false }),
}));
