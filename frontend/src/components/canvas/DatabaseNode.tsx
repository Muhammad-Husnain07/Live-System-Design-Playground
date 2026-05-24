import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Database, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function DatabaseNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <div className="mt-1 space-y-1">
        <svg width="100%" height="24" viewBox="0 0 180 24" className="overflow-visible">
          <ellipse cx="90" cy="4" rx="80" ry="4" fill="none" stroke="#52525b" strokeWidth="1.5" />
          <path d="M10 4 L10 20" stroke="#52525b" strokeWidth="1.5" />
          <path d="M170 4 L170 20" stroke="#52525b" strokeWidth="1.5" />
          <ellipse cx="90" cy="20" rx="80" ry="4" fill="none" stroke="#52525b" strokeWidth="1.5" />
          <ellipse cx="90" cy="12" rx="80" ry="4" fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 3" />
          <ellipse cx="90" cy="4" rx="80" ry="4" fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.3" />
        </svg>
        <div className="flex items-center gap-2 text-[9px] text-surface-500">
          <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {props.data?.config?.instances ?? 1} replicas</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {props.data?.config?.maxRPS ?? 0} max RPS</span>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(DatabaseNode);
