import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Inbox, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function MessageQueueNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const depth = data?.metrics?.queueDepth ?? 0;
  const maxDepth = 1000;
  const fillPct = Math.min((depth / maxDepth) * 100, 100);
  const barColor = fillPct > 80 ? "#EF4444" : fillPct > 50 ? "#F97316" : "#06B6D4";

  return (
    <BaseNode {...props}>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2 text-[9px] text-surface-500">
          <span className="flex items-center gap-1"><Inbox className="h-3 w-3" /> {props.data?.config?.instances ?? 3} brokers</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {props.data?.config?.maxRPS ?? 0} max RPS</span>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[8px] text-surface-500">
            <span>Queue depth</span>
            <span className="font-mono" style={{ color: barColor }}>{depth.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-surface-800 rounded-full overflow-hidden border border-surface-700/50">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${fillPct}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(MessageQueueNode);
