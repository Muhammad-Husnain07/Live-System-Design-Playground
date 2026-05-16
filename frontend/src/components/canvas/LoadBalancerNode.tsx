import { memo } from "react";
import { type NodeProps } from "reactflow";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function LoadBalancerNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <svg width="100%" height="16" viewBox="0 0 120 16" className="mt-0.5">
        <line x1="60" y1="2" x2="30" y2="14" stroke="#52525b" strokeWidth="1.5" />
        <line x1="60" y1="2" x2="60" y2="14" stroke="#52525b" strokeWidth="1.5" />
        <line x1="60" y1="2" x2="90" y2="14" stroke="#52525b" strokeWidth="1.5" />
        <circle cx="60" cy="2" r="2.5" fill="#a1a1aa" />
      </svg>
    </BaseNode>
  );
}

export default memo(LoadBalancerNode);
