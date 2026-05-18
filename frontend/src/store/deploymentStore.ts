import { create } from "zustand";

export interface DeployNodeState {
  blueGreenGroup: string;
  activeGroup: string;
}

interface DeployState {
  showDeployPanel: boolean;
  nodeStates: Record<string, DeployNodeState>;
  setShowDeployPanel: (show: boolean) => void;
  setNodeState: (nodeId: string, state: Partial<DeployNodeState>) => void;
  setNodeStates: (states: Record<string, DeployNodeState>) => void;
  reset: () => void;
}

export const useDeployStore = create<DeployState>((set) => ({
  showDeployPanel: false,
  nodeStates: {},
  setShowDeployPanel: (show) => set({ showDeployPanel: show }),
  setNodeState: (nodeId, partial) =>
    set((s) => ({
      nodeStates: {
        ...s.nodeStates,
        [nodeId]: { ...(s.nodeStates[nodeId] ?? { blueGreenGroup: "", activeGroup: "blue" }), ...partial },
      },
    })),
  setNodeStates: (states) => set({ nodeStates: states }),
  reset: () => set({ showDeployPanel: false, nodeStates: {} }),
}));
