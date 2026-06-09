import type { NodeTypes, EdgeTypes } from "reactflow";
import BaseNode from "./BaseNode";
import DatabaseNode from "./DatabaseNode";
import LoadBalancerNode from "./LoadBalancerNode";
import MessageQueueNode from "./MessageQueueNode";
import ContainerClusterNode from "./ContainerClusterNode";
import LLMNode from "./nodes/LLMNode";
import VectorDBNode from "./nodes/VectorDBNode";
import OrchestratorNode from "./nodes/OrchestratorNode";
import CustomEdge from "./CustomEdge";
import type { NodeType } from "../../types/canvas";

export const nodeTypes: NodeTypes = {
  default: BaseNode,
  database: DatabaseNode,
  loadBalancer: LoadBalancerNode,
  messageQueue: MessageQueueNode,
  containerCluster: ContainerClusterNode,
  llm: LLMNode,
  vectorDb: VectorDBNode,
  orchestrator: OrchestratorNode,
};

export const edgeTypes: EdgeTypes = {
  default: CustomEdge,
  smoothstep: CustomEdge,
};

export function getReactFlowType(nodeType: NodeType): string {
  switch (nodeType) {
    case "PostgreSQLDB":
    case "MySQLDB":
    case "MongoDB":
    case "Redis":
    case "Elasticsearch":
      return "database";
    case "LoadBalancer":
      return "loadBalancer";
    case "MessageQueue":
      return "messageQueue";
    case "ContainerCluster":
      return "containerCluster";
    case "LLMNode":
      return "llm";
    case "VectorDB":
      return "vectorDb";
    case "Orchestrator":
      return "orchestrator";
    default:
      return "default";
  }
}
