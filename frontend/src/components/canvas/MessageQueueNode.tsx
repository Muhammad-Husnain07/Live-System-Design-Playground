import { memo } from "react";
import { type NodeProps } from "reactflow";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function MessageQueueNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const depth = data?.metrics?.queueDepth ?? 0;
  const maxDepth = 1000;
  const fillPct = Math.min((depth / maxDepth) * 100, 100);

  return (
    <BaseNode {...props}>
      <div className="h-4 bg-surface-800 rounded overflow-hidden border border-surface-700/50">
        <div
          className="h-full rounded transition-all duration-700 ease-out"
          style={{
            width: `${fillPct}%`,
            backgroundColor: fillPct > 80 ? "#EF4444" : fillPct > 50 ? "#F97316" : "#06B6D4",
          }}
        />
      </div>
      <span className="text-[9px] text-surface-500 mt-0.5 block">{depth} queued</span>
    </BaseNode>
  );
}

export default memo(MessageQueueNode);
