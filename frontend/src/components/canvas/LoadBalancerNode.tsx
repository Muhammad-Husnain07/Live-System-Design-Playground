import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Scale, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function LoadBalancerNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <div className="mt-1 space-y-1">
        <div className="flex items-center justify-center gap-6 py-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-60">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <rect x="14" y="2" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <rect x="8" y="14" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <line x1="6" y1="10" x2="10" y2="14" stroke="#52525b" strokeWidth="1" />
            <line x1="18" y1="10" x2="14" y2="14" stroke="#52525b" strokeWidth="1" />
          </svg>
        </div>
        <div className="flex items-center justify-center gap-3 text-[9px] text-surface-500">
          <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> {props.data?.config?.instances ?? 2} nodes</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {props.data?.config?.maxRPS ?? 0} max RPS</span>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(LoadBalancerNode);
