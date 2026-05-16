import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useProjectStore } from "../store/projectStore";

const initialNodes: Node[] = [
  {
    id: "client",
    type: "default",
    position: { x: 250, y: 0 },
    data: { label: "Client" },
  },
  {
    id: "server",
    type: "default",
    position: { x: 250, y: 150 },
    data: { label: "Server" },
  },
  {
    id: "database",
    type: "default",
    position: { x: 250, y: 300 },
    data: { label: "Database" },
  },
];

const initialEdges: Edge[] = [
  { id: "e-client-server", source: "client", target: "server" },
  { id: "e-server-db", source: "server", target: "database" },
];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, isLoading, error, getProject, saveCanvas } = useProjectStore();
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  useEffect(() => {
    if (id) getProject(id);
  }, [id, getProject]);

  useEffect(() => {
    if (currentProject?.canvas_data?.nodes || currentProject?.canvas_data?.edges) {
      const cd = currentProject.canvas_data;
      if (cd.nodes?.length) setNodes(cd.nodes);
      if (cd.edges?.length) setEdges(cd.edges);
    }
    }, [currentProject]);

  const autoSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const canvasData = { nodes: nodesRef.current, edges: edgesRef.current };
      const updatedAt = await saveCanvas(id, canvasData);
      setLastSaved(updatedAt);
    } catch {}
    setSaving(false);
  }, [id, saveCanvas]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 2000);
  }, [autoSave]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      scheduleSave();
    },
    [scheduleSave],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      scheduleSave();
    },
    [scheduleSave],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      scheduleSave();
    },
    [scheduleSave],
  );

  if (isLoading && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-surface-400 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error && !currentProject) {
    return (
      <div className="h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-950 text-surface-100 flex flex-col">
      <header className="border-b border-surface-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            &larr; Dashboard
          </button>
          <h1 className="text-sm font-medium">{currentProject?.name || "Project"}</h1>
          {currentProject?.role && (
            <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded">
              {currentProject.role}
            </span>
          )}
          <span className="text-[10px] text-surface-500">
            {saving ? "saving..." : lastSaved ? "saved" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/project/${id}/observe`)}
            className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            Observability
          </button>
        </div>
      </header>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#27272a" gap={20} />
          <Controls className="bg-surface-900 border-surface-700 [&>button]:border-surface-700 [&>button]:bg-surface-800 [&>button]:hover:bg-surface-700" />
          <MiniMap
            className="border border-surface-700 rounded-lg"
            style={{ background: "#09090b" }}
            nodeColor="#27272a"
            maskColor="rgba(9,9,11,0.7)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
