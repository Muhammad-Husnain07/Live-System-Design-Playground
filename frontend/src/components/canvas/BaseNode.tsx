import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { X, Skull, Flame, Check, CircleSlash, Globe, AlertTriangle, Circle } from "lucide-react";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { useChaosStore } from "../../store/chaosStore";
import { useSecurityStore } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useDeployStore } from "../../store/deploymentStore";
import { useFinOpsStore } from "../../store/finopsStore";
import { NODE_COMPAT } from "../../store/exportStore";
import type { CanvasNode } from "../../types/canvas";

export type BaseNodeData = CanvasNode["data"];

export interface BaseNodeProps extends NodeProps<BaseNodeData> {
  children?: ReactNode;
}

const MIN_W = 180;
const MIN_H = 80;
const DEFAULT_W = 220;
const DEFAULT_H = 120;

const handleClass = "!opacity-0 group-hover:!opacity-100 !transition-opacity !w-3 !h-3 !border-2 !bg-surface-900 !border-surface-500 hover:!border-blue-400 !z-20";

function ResizeHandle({ nodeId }: { nodeId: string }) {
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      const rawW = node?.style?.width;
      const rawH = node?.style?.height;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: typeof rawW === "number" ? rawW : DEFAULT_W,
        h: typeof rawH === "number" ? rawH : DEFAULT_H,
      };

      const onMove = (ev: PointerEvent) => {
        const dw = ev.clientX - startRef.current.x;
        const dh = ev.clientY - startRef.current.y;
        const newW = Math.max(MIN_W, startRef.current.w + dw);
        const newH = Math.max(MIN_H, startRef.current.h + dh);
        resizeNode(nodeId, Math.round(newW), Math.round(newH));
      };

      const onUp = () => {
        setResizing(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [nodeId, resizeNode],
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute bottom-0 right-0 z-30 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity ${resizing ? "!opacity-100" : ""}`}
      style={{ touchAction: "none" }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" className="drop-shadow-md">
        <path d="M14 0v14H0l4-4h6V4l4-4z" fill="rgba(96,165,250,0.6)" stroke="rgba(96,165,250,0.9)" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function BaseNode({ id, data, selected, isConnectable, children }: BaseNodeProps) {
  const nodeType = data?.nodeType;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : null;

  if (!meta) {
    return (
      <div className="bg-red-950/40 border border-red-500/30 rounded px-2 py-1 text-[10px] text-red-400">
        Unknown
      </div>
    );
  }

  const [hovered, setHovered] = useState(false);
  const nodeId = id ?? "";
  const { config, label, metrics } = data;
  const isFailed = config?.isFailed ?? false;
  const isBottleneck = config?.isBottleneck ?? false;
  const isCanary = config?.deployment?.isCanaryActive ?? false;
  const isPublic = config?.security?.isPublicFacing ?? false;
  const deployStrategy = config?.deployment?.strategy;
  const bgState = useDeployStore((s) => s.nodeStates[nodeId]);
  const bgActiveGroup = bgState?.activeGroup ?? config?.deployment?.activeGroup ?? "";
  const totalRPS = metrics?.currentRPS ?? 0;
  const canaryRPS = metrics?.canaryRPS ?? 0;
  const errorRate = metrics?.errorRate ?? 0;
  const stablePct = totalRPS > 0 ? Math.round(((totalRPS - canaryRPS) / totalRPS) * 100) : 100;
  const canaryPct = 100 - stablePct;
  const isCanaryFailing = isCanary && errorRate > 0.3;
  const bgBorderColor = deployStrategy === "blue_green" && bgActiveGroup === "green" ? "#22C55E" : deployStrategy === "blue_green" && bgActiveGroup === "blue" ? "#3B82F6" : null;
  const hasChaos = useChaosStore((s) => s.activeNodeIds.includes(nodeId));
  const isSecurityHighlighted = useSecurityStore((s) => s.highlightedNodeIds.includes(nodeId));
  const exportMode = useCanvasStore((s) => s.exportMode);
  const compatStatus = NODE_COMPAT[nodeType] ?? "skipped";
  const nodeCost = useFinOpsStore((s) => s.nodeCosts.find((c) => c.nodeId === id));
  const nw = useCanvasStore((s) => {
    const n = s.nodes.find((n) => n.id === nodeId);
    const raw = n?.style?.width;
    return typeof raw === "number" ? raw : undefined;
  });
  const nh = useCanvasStore((s) => {
    const n = s.nodes.find((n) => n.id === nodeId);
    const raw = n?.style?.height;
    return typeof raw === "number" ? raw : undefined;
  });
  const dimStyle = nw || nh ? { width: nw ?? DEFAULT_W, height: nh ?? DEFAULT_H } : undefined;

  const borderColor = bgBorderColor ?? (isFailed ? "#EF4444" : hasChaos ? "#F97316" : isSecurityHighlighted ? "#EF4444" : selected ? "#60A5FA" : meta.color);
  const shadowColor = isFailed ? "rgba(239,68,68,0.4)" : hasChaos ? "rgba(249,115,22,0.5)" : isSecurityHighlighted ? "rgba(239,68,68,0.5)" : selected ? "rgba(96,165,250,0.4)" : hovered ? `${meta.color}40` : "rgba(0,0,0,0)";
  const shadowIntensity = selected || isFailed || hasChaos || isSecurityHighlighted ? "14px" : hovered ? "10px" : "0px";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="relative group group/node overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={dimStyle}
    >
      <Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} className={handleClass} />
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} className={handleClass} />

      {isFailed && (
        <div className="absolute inset-0 z-10 bg-red-500/10 rounded-lg flex items-center justify-center pointer-events-none backdrop-blur-[1px]">
          <span title="Node failed"><X className="text-2xl drop-shadow-lg text-red-400" /></span>
        </div>
      )}
      {hasChaos && !isFailed && (
        <div className="absolute -top-2 -right-2 z-20" title="Chaos active">
          <span title="Chaos active"><Skull className="h-4 w-4 drop-shadow-lg animate-pulse text-orange-400" /></span>
        </div>
      )}
      {isBottleneck && !isFailed && (
        <div className="absolute -top-2 -left-2 z-20" title="Bottleneck detected">
          <span title="Bottleneck detected"><Flame className="h-4 w-4 drop-shadow-lg animate-pulse text-orange-400" /></span>
        </div>
      )}
      {exportMode && (
        <div
          className={`absolute -top-2 -left-2 z-20 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-lg ${
            compatStatus === "supported"
              ? "bg-green-950 text-green-400 border-green-500/50"
              : "bg-red-950 text-red-400 border-red-500/50"
          }`}
          title={compatStatus === "supported" ? "IaC Supported" : "IaC Skipped (no mapping)"}
        >
          {compatStatus === "supported" ? <Check className="w-3 h-3" /> : <CircleSlash className="w-3 h-3" />}
        </div>
      )}
      {nodeCost && (
        <div className="absolute -bottom-1 -right-1 z-20 bg-green-950/80 text-green-400 text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-green-500/40 shadow-lg backdrop-blur-sm">
          ${nodeCost.monthlyCost.toFixed(0)}/mo
        </div>
      )}

      <div
        className={`w-full h-full bg-gradient-to-b from-surface-850 to-surface-900 rounded-lg border-2 shadow-lg transition-all duration-200 ${
          isFailed ? "animate-pulse" : ""
        }`}
        style={{
          borderColor,
          boxShadow: `0 0 ${shadowIntensity} ${shadowColor}${hovered && !selected && !isFailed && !hasChaos && !isSecurityHighlighted ? ", 0 4px 12px rgba(0,0,0,0.3)" : ""}`,
        }}
      >
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ backgroundColor: `${meta.color}20` }}
          >
            <meta.icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-surface-100 truncate leading-tight">{label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
              <span className="text-[9px] text-surface-500 font-medium uppercase tracking-wider">{meta.category}</span>
              {isPublic && <span className="text-[9px] text-blue-400 font-medium ml-auto" title="Public facing"><Globe className="h-3 w-3 inline" /> Public</span>}
            </div>
          </div>
        </div>

        {children && <div className="px-3 pb-1">{children}</div>}

        {(deployStrategy === "blue_green" || isCanary) && (
          <div className="px-3 pb-1.5 flex items-center gap-1.5 flex-wrap">
            {deployStrategy === "blue_green" && bgActiveGroup && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  bgActiveGroup === "blue"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    : "bg-green-500/15 text-green-400 border border-green-500/20"
                }`}
              >
                {bgActiveGroup === "blue" ? <><Circle className="h-2 w-2 fill-current" /> Blue</> : <><Circle className="h-2 w-2 fill-current" /> Green</>}
              </span>
            )}
            {isCanary && (
              <span className="text-[9px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                {config.deployment.canaryVersion || "v2"}
              </span>
            )}
            {isCanaryFailing && (
              <span className="text-[9px] text-red-400 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" /> Canary failing
              </span>
            )}
          </div>
        )}

        {deployStrategy === "canary" && totalRPS > 0 && (
          <div className="px-3 pb-1.5">
            <div className="h-2 bg-surface-800 rounded-full overflow-hidden flex border border-surface-700/50">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${stablePct}%` }} title={`Stable: ${stablePct}%`} />
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${canaryPct}%` }} title={`Canary: ${canaryPct}%`} />
            </div>
          </div>
        )}

        {metrics && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-surface-700/40 bg-surface-950/40 rounded-b-lg">
            <div className="flex items-center gap-1.5" title={`CPU: ${Math.round(metrics.cpuPercent)}%`}>
              <div className="w-10 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(metrics.cpuPercent, 0), 100)}%`,
                    backgroundColor: metrics.cpuPercent > 80 ? "#EF4444" : metrics.cpuPercent > 60 ? "#F97316" : "#3B82F6",
                  }}
                />
              </div>
              <span className="text-[8px] text-surface-500 font-mono">CPU</span>
            </div>
            <div className="flex items-center gap-1.5" title={`MEM: ${Math.round(metrics.memoryPercent)}%`}>
              <div className="w-10 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(Math.max(metrics.memoryPercent, 0), 100)}%`,
                    backgroundColor: metrics.memoryPercent > 80 ? "#EF4444" : metrics.memoryPercent > 60 ? "#F97316" : "#22C55E",
                  }}
                />
              </div>
              <span className="text-[8px] text-surface-500 font-mono">MEM</span>
            </div>
            <span className="ml-auto text-[9px] font-mono text-surface-400 font-medium">{metrics.currentRPS.toLocaleString()} <span className="text-surface-600">RPS</span></span>
          </div>
        )}

        <ResizeHandle nodeId={nodeId} />
      </div>
    </motion.div>
  );
}

export default memo(BaseNode);
