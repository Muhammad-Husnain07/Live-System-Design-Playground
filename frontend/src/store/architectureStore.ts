import { create } from "zustand";
import type { Node, Edge } from "reactflow";

export type BadgeType = "zero-trust" | "edge-optimized" | "ai-ready";

export interface ArchitectureInsight {
  label: string;
  met: boolean;
  detail: string;
}

export interface Scorecard {
  title: string;
  icon: string;
  color: string;
  items: ArchitectureInsight[];
}

interface ArchitectureState {
  nodeBadges: Record<string, BadgeType[]>;
  scorecards: Scorecard[];
  computeBadges: (nodes: Node[], edges: Edge[]) => void;
}

function getNodeType(n: Node): string {
  return (n.data as any)?.nodeType ?? "";
}

function getNodeConfig(n: Node): Record<string, any> {
  return (n.data as any)?.config ?? {};
}

function hasNodeType(nodes: Node[], type: string): boolean {
  return nodes.some((n) => getNodeType(n) === type);
}

function nodeHasEdgeToType(nodeId: string, edges: Edge[], targetType: string, nodes: Node[]): boolean {
  const targetIds = nodes.filter((n) => getNodeType(n) === targetType).map((n) => n.id);
  return edges.some(
    (e) => (e.source === nodeId && targetIds.includes(e.target)) || (e.target === nodeId && targetIds.includes(e.source)),
  );
}

export const useArchitectureStore = create<ArchitectureState>((set) => ({
  nodeBadges: {},
  scorecards: [],
  computeBadges: (nodes, edges) => {
    const badges: Record<string, BadgeType[]> = {};
    for (const n of nodes) {
      badges[n.id] = [];
    }

    const nodeTypes = nodes.map(getNodeType);
    const hasFirewall = nodeTypes.includes("Firewall");
    const hasServiceMesh = nodeTypes.includes("ServiceMesh");
    const hasEdgeCompute = nodeTypes.includes("EdgeCompute");
    const hasCDN = nodeTypes.includes("CDN");
    const hasLLM = nodeTypes.includes("LLMNode");
    const hasVectorDB = nodeTypes.includes("VectorDB");
    const hasRedis = nodeTypes.includes("Redis");

    const trustZoneIds = new Set<string>();
    for (const n of nodes) {
      const cfg = getNodeConfig(n);
      const sec = cfg?.security;
      if (sec?.isPublicFacing === false || hasFirewall || hasServiceMesh) {
        trustZoneIds.add(n.id);
      }
    }

    for (const n of nodes) {
      const nt = getNodeType(n);
      const id = n.id;

      if ((hasFirewall || hasServiceMesh) && trustZoneIds.has(id)) {
        badges[id].push("zero-trust");
      }

      if (nt === "EdgeCompute" || nt === "CDN") {
        badges[id].push("edge-optimized");
      } else if (hasEdgeCompute && nodeHasEdgeToType(id, edges, "EdgeCompute", nodes)) {
        badges[id].push("edge-optimized");
      }

      if ((nt === "LLMNode" || nt === "VectorDB") && hasRedis) {
        badges[id].push("ai-ready");
      } else if (hasLLM && hasVectorDB && (nt === "Redis" || nt === "AppServer")) {
        badges[id].push("ai-ready");
      }
    }

    const aiReadiness: ArchitectureInsight[] = [
      { label: "LLM / AI Model Deployed", met: hasLLM, detail: hasLLM ? "LLMNode present on canvas" : "Add an LLMNode for AI workloads" },
      { label: "Vector Database for RAG", met: hasVectorDB, detail: hasVectorDB ? "VectorDB present on canvas" : "Add a VectorDB for semantic search" },
      { label: "Caching Layer (Redis)", met: hasRedis, detail: hasRedis ? "Redis cache available" : "Add Redis to reduce latency & cost" },
      { label: "Security Boundary", met: hasFirewall || hasServiceMesh, detail: hasFirewall || hasServiceMesh ? "Firewall or ServiceMesh enforces Zero Trust" : "Add a Firewall or ServiceMesh for Zero Trust" },
    ];

    const edgeReadiness: ArchitectureInsight[] = [
      { label: "CDN for Static Assets", met: hasCDN, detail: hasCDN ? "CDN accelerates global content delivery" : "Add a CDN for static asset delivery" },
      { label: "Edge Compute for Auth/Routing", met: hasEdgeCompute, detail: hasEdgeCompute ? "EdgeCompute handles low-latency operations" : "Add EdgeCompute for global edge processing" },
    ];

    const resilience: ArchitectureInsight[] = [
      { label: "Orchestrator for Sagas", met: nodeTypes.includes("Orchestrator"), detail: nodeTypes.includes("Orchestrator") ? "Orchestrator coordinates distributed transactions" : "Add an Orchestrator for saga patterns" },
      { label: "Async Messaging (MQ)", met: nodeTypes.includes("MessageQueue") || nodeTypes.includes("EventBus") || nodeTypes.includes("PubSub"), detail: nodeTypes.includes("MessageQueue") || nodeTypes.includes("EventBus") || nodeTypes.includes("PubSub") ? "Async messaging decouples services" : "Add a MessageQueue for async communication" },
      { label: "Multi-Region Redundancy", met: nodeTypes.filter((t) => t === "PostgreSQLDB" || t === "AppServer").length > 2, detail: nodeTypes.filter((t) => t === "PostgreSQLDB" || t === "AppServer").length > 2 ? "Multiple instances suggest multi-region capability" : "Duplicate key services across regions for HA" },
    ];

    set({
      nodeBadges: badges,
      scorecards: [
        { title: "AI Readiness", icon: "\uD83E\uDD16", color: "#a855f7", items: aiReadiness },
        { title: "Edge Readiness", icon: "\u26A1", color: "#22c55e", items: edgeReadiness },
        { title: "Resilience", icon: "\uD83D\uDEE1\uFE0F", color: "#3b82f6", items: resilience },
      ],
    });
  },
}));
