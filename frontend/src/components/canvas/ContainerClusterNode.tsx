import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Container, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

const TOTAL_PODS = 12;

function ContainerClusterNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const running = data?.config?.instances ?? 3;
  const healthyCount = Math.min(running, TOTAL_PODS);

  return (
    <BaseNode {...props}>
      <div className="mt-1 space-y-1">
        <div className="grid grid-cols-4 gap-1 py-0.5">
          {Array.from({ length: TOTAL_PODS }).map((_, i) => {
            const isHealthy = i < healthyCount;
            return (
              <div
                key={i}
                className={`w-4 h-4 rounded-sm border transition-all duration-300 ${
                  isHealthy
                    ? "border-green-600/50 bg-green-500/20 shadow-[inset_0_0_6px_rgba(34,197,94,0.15)]"
                    : "border-surface-700/50 bg-surface-800/50"
                }`}
                title={isHealthy ? `Pod ${i + 1}: Running` : `Pod ${i + 1}: Idle`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-surface-500">
          <span className="flex items-center gap-1"><Container className="h-3 w-3" /> {healthyCount}/{TOTAL_PODS} pods</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {props.data?.config?.maxRPS ?? 0} max RPS</span>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(ContainerClusterNode);
