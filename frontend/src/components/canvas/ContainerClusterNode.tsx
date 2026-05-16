import { memo } from "react";
import { type NodeProps } from "reactflow";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

const TOTAL_PODS = 9;

function ContainerClusterNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const running = data?.config?.instances ?? 3;
  const healthyCount = Math.min(running, TOTAL_PODS);

  return (
    <BaseNode {...props}>
      <div className="grid grid-cols-3 gap-1 mt-1">
        {Array.from({ length: TOTAL_PODS }).map((_, i) => {
          const isHealthy = i < healthyCount;
          return (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-sm border transition-colors ${
                isHealthy
                  ? "border-green-600 bg-green-500/30"
                  : "border-surface-700 bg-surface-800"
              }`}
            />
          );
        })}
      </div>
    </BaseNode>
  );
}

export default memo(ContainerClusterNode);
