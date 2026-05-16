import { memo, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { CanvasNode } from "../../types/canvas";

export type BaseNodeData = CanvasNode["data"];

export interface BaseNodeProps extends NodeProps<BaseNodeData> {
  children?: ReactNode;
}

function BaseNode({ data, selected, isConnectable, children }: BaseNodeProps) {
  const nodeType = data?.nodeType;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : null;

  if (!meta) {
    return (
      <div className="bg-red-950/40 border border-red-500/30 rounded px-2 py-1 text-[10px] text-red-400">
        Unknown
      </div>
    );
  }

  const { config, label, metrics } = data;
  const isFailed = config?.isFailed ?? false;
  const isBottleneck = config?.isBottleneck ?? false;
  const isCanary = config?.deployment?.isCanaryActive ?? false;
  const isPublic = config?.security?.isPublicFacing ?? false;
  const handleClass = "!opacity-0 group-hover:!opacity-100 !transition-opacity !w-3 !h-3 !border-2 !bg-surface-800 !border-surface-500";

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative group"
    >
      <Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />

      {isFailed && (
        <div className="absolute inset-0 z-10 bg-red-500/10 rounded-lg flex items-center justify-center pointer-events-none">
          <span className="text-2xl drop-shadow-lg">❌</span>
        </div>
      )}

      <div
        className={`bg-surface-900 rounded-lg border-2 shadow-lg transition-shadow ${
          isFailed ? "animate-pulse border-red-500" : selected ? "border-3" : ""
        }`}
        style={{
          borderColor: isFailed ? "#EF4444" : selected ? "#60A5FA" : meta.color,
          boxShadow: isFailed
            ? "0 0 14px rgba(239,68,68,0.4)"
            : selected
              ? "0 0 14px rgba(96,165,250,0.4)"
              : undefined,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-700/50">
          <span className="text-lg">{meta.icon}</span>
          <span className="text-sm font-medium text-surface-100 truncate flex-1">{label}</span>
          {isPublic && <span className="text-xs" title="Public facing">🌐</span>}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
          <span className="text-[10px] text-surface-400">{meta.label}</span>
          {isCanary && (
            <span className="ml-auto text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded leading-tight">
              {config.deployment.canaryVersion || "v2"}
            </span>
          )}
        </div>

        {children && <div className="px-3 pb-1.5">{children}</div>}

        {isBottleneck && (
          <div className="px-3 pb-1.5">
            <span className="text-[10px] text-orange-400 flex items-center gap-1">
              ⚠️ Bottleneck
            </span>
          </div>
        )}

        {metrics && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-surface-700/50 text-[9px] text-surface-400">
            <MiniBar value={metrics.cpuPercent} label="CPU" danger />
            <MiniBar value={metrics.memoryPercent} label="MEM" danger={false} />
            <span className="ml-auto font-mono">{metrics.currentRPS.toLocaleString()} RPS</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MiniBar({ value, label, danger }: { value: number; label: string; danger: boolean }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-1" title={`${label}: ${Math.round(pct)}%`}>
      <div className="w-8 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 80 ? "#EF4444" : danger ? "#F97316" : "#3B82F6",
          }}
        />
      </div>
      <span>{label}</span>
    </div>
  );
}

export default memo(BaseNode);
