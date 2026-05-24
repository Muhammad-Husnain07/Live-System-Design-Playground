import { create } from "zustand";
import type { Node, Edge } from "reactflow";
import type { NodeConfig, NodeMetrics, CanvasState } from "../types/canvas";

const MAX_UNDO = 50;

function clone(nodes: Node[], edges: Edge[]): CanvasState {
  return JSON.parse(JSON.stringify({ nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } }));
}

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isSimulationRunning: boolean;
  simulationSpeed: number;
  isDirty: boolean;
  lastSaved: string | null;
  pastStates: CanvasState[];
  futureStates: CanvasState[];
  collabConnected: boolean;
  exportMode: boolean;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  loadTemplate: (templateNodes: Node[], templateEdges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Partial<NodeConfig>) => void;
  updateNodeData: (id: string, data: Record<string, any>) => void;
  updateNodeMetrics: (id: string, metrics: Partial<NodeMetrics>) => void;
  updateEdge: (id: string, data: Record<string, any>) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  markDirty: () => void;
  markSaved: (timestamp: string) => void;
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;
  setSimulationRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  setCollabConnected: (connected: boolean) => void;
  setExportMode: (mode: boolean) => void;
  clearSimulationMetrics: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isSimulationRunning: false,
  simulationSpeed: 1,
  isDirty: false,
  lastSaved: null,
  pastStates: [],
  futureStates: [],
  collabConnected: false,
  exportMode: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  loadTemplate: (templateNodes: Node[], templateEdges: Edge[]) => {
    const { nodes, edges, pastStates } = get();
    set({
      nodes: [...nodes, ...templateNodes],
      edges: [...edges, ...templateEdges],
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  addNode: (node) => {
    const { nodes, edges, pastStates } = get();
    set({
      nodes: [...nodes, node],
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  removeNode: (id) => {
    const { nodes, edges, pastStates, selectedNodeId } = get();
    set({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
      isDirty: true,
    });
  },

  updateNodeConfig: (id, config) => {
    const { nodes, edges, pastStates } = get();
    set({
      nodes: nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
          : n,
      ),
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  updateNodeData: (id, data) => {
    const { nodes, edges, pastStates } = get();
    set({
      nodes: nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  updateNodeMetrics: (id, metrics) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, metrics: { ...n.data.metrics, ...metrics } } }
          : n,
      ),
    });
  },

  updateEdge: (id, data) => {
    const { nodes, edges, pastStates } = get();
    set({
      edges: edges.map((e) => {
        if (e.id !== id) return e;
        const newData = { ...e.data, ...data };
        if (data?.routing && e.data?.routing) {
          newData.routing = { ...e.data.routing, ...data.routing };
        }
        return { ...e, data: newData };
      }),
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),

  addEdge: (edge) => {
    const { nodes, edges, pastStates } = get();
    set({
      edges: [...edges, edge],
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      isDirty: true,
    });
  },

  removeEdge: (id) => {
    const { nodes, edges, pastStates, selectedEdgeId } = get();
    set({
      edges: edges.filter((e) => e.id !== id),
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
      selectedEdgeId: selectedEdgeId === id ? null : selectedEdgeId,
      isDirty: true,
    });
  },

  markDirty: () => set({ isDirty: true }),

  markSaved: (timestamp) => set({ isDirty: false, lastSaved: timestamp }),

  pushUndoState: () => {
    const { nodes, edges, pastStates } = get();
    set({
      pastStates: [...pastStates, clone(nodes, edges)].slice(-MAX_UNDO),
      futureStates: [],
    });
  },

  undo: () => {
    const { pastStates, nodes, edges, futureStates } = get();
    if (pastStates.length === 0) return;
    const prev = pastStates[pastStates.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      pastStates: pastStates.slice(0, -1),
      futureStates: [...futureStates, clone(nodes, edges)],
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    });
  },

  redo: () => {
    const { pastStates, nodes, edges, futureStates } = get();
    if (futureStates.length === 0) return;
    const next = futureStates[futureStates.length - 1];
    set({
      nodes: next.nodes,
      edges: next.edges,
      pastStates: [...pastStates, clone(nodes, edges)],
      futureStates: futureStates.slice(0, -1),
      selectedNodeId: null,
      selectedEdgeId: null,
      isDirty: true,
    });
  },

  setSimulationRunning: (running) => set({ isSimulationRunning: running }),

  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

  setCollabConnected: (connected) => set({ collabConnected: connected }),

  setExportMode: (mode) => set({ exportMode: mode }),

  clearSimulationMetrics: () => {
    set({
      nodes: get().nodes.map((n) => {
        const { metrics, ...restData } = n.data;
        return { ...n, data: restData };
      }),
      isSimulationRunning: false,
    });
  },
}));
