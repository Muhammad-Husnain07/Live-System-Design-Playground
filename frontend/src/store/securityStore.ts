import { create } from "zustand";

export interface SecurityViolation {
  severity: "critical" | "warning";
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  message: string;
}

interface SecurityState {
  violations: SecurityViolation[];
  showSecurityPanel: boolean;
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  setViolations: (v: SecurityViolation[]) => void;
  setShowSecurityPanel: (show: boolean) => void;
  highlightViolation: (violation: SecurityViolation, edges: { id: string; source: string; target: string }[]) => void;
  clearHighlights: () => void;
  reset: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  violations: [],
  showSecurityPanel: false,
  highlightedNodeIds: [],
  highlightedEdgeIds: [],
  setViolations: (violations) => set({ violations }),
  setShowSecurityPanel: (show) => set({ showSecurityPanel: show, highlightedNodeIds: [], highlightedEdgeIds: [] }),
  highlightViolation: (violation, edges) => {
    const nodeIds: string[] = [];
    if (violation.sourceNodeId) nodeIds.push(violation.sourceNodeId);
    if (violation.targetNodeId && violation.targetNodeId !== violation.sourceNodeId) nodeIds.push(violation.targetNodeId);
    const edgeIds = edges
      .filter((e) => e.source === violation.sourceNodeId && e.target === violation.targetNodeId)
      .map((e) => e.id);
    set({ highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds });
  },
  clearHighlights: () => set({ highlightedNodeIds: [], highlightedEdgeIds: [] }),
  reset: () => set({ violations: [], showSecurityPanel: false, highlightedNodeIds: [], highlightedEdgeIds: [] }),
}));
