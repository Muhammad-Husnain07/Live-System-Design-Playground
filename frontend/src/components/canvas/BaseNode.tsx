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
import { Box, Stack, Typography, LinearProgress, Chip, Badge } from "@mui/material";

export type BaseNodeData = CanvasNode["data"];

export interface BaseNodeProps extends NodeProps<BaseNodeData> {
  children?: ReactNode;
}

const MIN_W = 180;
const MIN_H = 80;
const DEFAULT_W = 220;
const DEFAULT_H = 120;

const handleStyle: React.CSSProperties = {
  opacity: 0,
  transition: "opacity 0.2s",
  width: 12,
  height: 12,
  borderWidth: 2,
  borderColor: "#71717a",
  background: "#18181b",
  zIndex: 20,
};

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
    <Box
      onPointerDown={onPointerDown}
      sx={{
        position: "absolute", bottom: 0, right: 0, zIndex: 30,
        cursor: "nwse-resize", opacity: 0, transition: "opacity 0.2s",
        "&:hover": { opacity: 1 },
        touchAction: "none",
      }}
      style={resizing ? { opacity: 1 } : undefined}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
        <path d="M14 0v14H0l4-4h6V4l4-4z" fill="rgba(96,165,250,0.6)" stroke="rgba(96,165,250,0.9)" strokeWidth="0.5" />
      </svg>
    </Box>
  );
}

function BaseNode({ id, data, selected, isConnectable, children }: BaseNodeProps) {
  const nodeType = data?.nodeType;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : null;

  if (!meta) {
    return (
      <Box sx={{ bgcolor: "rgba(127,29,29,0.4)", border: 1, borderColor: "rgba(239,68,68,0.3)", borderRadius: 1, px: 1, py: 0.5, fontSize: "10px", color: "#ef4444" }}>
        Unknown
      </Box>
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

  const nodeColor = bgBorderColor ?? (isFailed ? "#EF4444" : hasChaos ? "#F97316" : isSecurityHighlighted ? "#EF4444" : selected ? "#60A5FA" : meta.color);
  const shadowColor = isFailed ? "rgba(239,68,68,0.4)" : hasChaos ? "rgba(249,115,22,0.5)" : isSecurityHighlighted ? "rgba(239,68,68,0.5)" : selected ? "rgba(96,165,250,0.4)" : hovered ? `${meta.color}40` : "rgba(0,0,0,0)";
  const shadowIntensity = selected || isFailed || hasChaos || isSecurityHighlighted ? "14px" : hovered ? "10px" : "0px";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{ position: "relative", overflow: "hidden", ...dimStyle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />

      {isFailed && (
        <Box sx={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <Chip size="small" color="error" label="FAILED" icon={<X size={12} />} />
        </Box>
      )}
      {hasChaos && !isFailed && (
        <Box sx={{ position: "absolute", top: -8, right: -8, zIndex: 20 }} title="Chaos active">
          <Skull size={16} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))", color: "#fb923c" }} />
        </Box>
      )}
      {isBottleneck && !isFailed && (
        <Box sx={{ position: "absolute", top: -8, left: -8, zIndex: 20 }} title="Bottleneck detected">
          <Flame size={16} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))", color: "#fb923c" }} />
        </Box>
      )}
      {exportMode && (
        <Box
          sx={{
            position: "absolute", top: -8, left: -8, zIndex: 20, width: 20, height: 20,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, border: 2, boxShadow: 2,
            bgcolor: compatStatus === "supported" ? "rgba(0,128,0,0.3)" : "rgba(128,0,0,0.3)",
            borderColor: compatStatus === "supported" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
          }}
          title={compatStatus === "supported" ? "IaC Supported" : "IaC Skipped (no mapping)"}
        >
          {compatStatus === "supported" ? <Check size={12} style={{ color: "#22c55e" }} /> : <CircleSlash size={12} style={{ color: "#ef4444" }} />}
        </Box>
      )}
      {nodeCost && (
        <Box
          sx={{
            position: "absolute", bottom: -4, right: -4, zIndex: 20,
            bgcolor: "rgba(0,128,0,0.5)", fontSize: 9, fontFamily: "monospace",
            px: 0.75, py: 0.25, borderRadius: "999px", border: 1, borderColor: "rgba(34,197,94,0.4)",
            boxShadow: 2, backdropFilter: "blur(4px)", color: "#22c55e",
          }}
        >
          ${nodeCost.monthlyCost.toFixed(0)}/mo
        </Box>
      )}

      <Box
        sx={{
          p: 1.5, bgcolor: "#18181b", border: 1, borderColor: nodeColor,
          borderRadius: 1, minWidth: 150, textAlign: "center",
          opacity: isFailed ? 0.6 : 1,
          boxShadow: `0 0 ${shadowIntensity} ${shadowColor}${hovered && !selected && !isFailed && !hasChaos && !isSecurityHighlighted ? ", 0 4px 12px rgba(0,0,0,0.3)" : ""}`,
          transition: "box-shadow 0.2s",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <Box
            sx={{ width: 28, height: 28, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}
            style={{ backgroundColor: `${meta.color}20` }}
          >
            <meta.icon size={16} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ display: "block", lineHeight: 1.3, color: "#f4f4f5", fontSize: "0.8rem", fontWeight: "bold" }}>
              {label}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: meta.color }} />
              <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a" }}>
                {meta.category}
              </Typography>
              {isPublic && (
                <Typography variant="caption" sx={{ fontSize: 9, ml: "auto", color: "#60a5fa" }} title="Public facing">
                  <Globe size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Public
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>

        {children && <Box sx={{ mb: 0.5 }}>{children}</Box>}

        {(deployStrategy === "blue_green" || isCanary) && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", mb: 0.75, px: 0.5 }}>
            {deployStrategy === "blue_green" && bgActiveGroup && (
              <Chip
                size="small"
                icon={<Circle size={8} style={{ fill: "currentColor" }} />}
                label={bgActiveGroup === "blue" ? "Blue" : "Green"}
                sx={{
                  height: 18, fontSize: 9,
                  bgcolor: bgActiveGroup === "blue" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
                  color: bgActiveGroup === "blue" ? "#60a5fa" : "#22c55e",
                  border: 1, borderColor: bgActiveGroup === "blue" ? "rgba(59,130,246,0.2)" : "rgba(34,197,94,0.2)",
                  "& .MuiChip-icon": { ml: 0.5 },
                }}
              />
            )}
            {isCanary && (
              <Badge
                badgeContent={config.deployment.canaryVersion || "v2"}
                color="secondary"
                slotProps={{
                  badge: {
                    sx: {
                      fontSize: 9, height: 18, minWidth: 18, px: 0.5,
                      bgcolor: "rgba(168,85,247,0.15)", color: "#a78bfa",
                      border: "1px solid rgba(168,85,247,0.2)", position: "static",
                      transform: "none", borderRadius: "4px",
                    },
                  },
                }}
              >
                <Box sx={{ display: "none" }} />
              </Badge>
            )}
            {isCanaryFailing && (
              <Chip
                size="small"
                icon={<AlertTriangle size={10} />}
                label="Failing"
                color="error"
                sx={{ height: 18, fontSize: 9, animation: "chaos-flash 1.5s ease-in-out infinite" }}
              />
            )}
          </Stack>
        )}

        {deployStrategy === "canary" && totalRPS > 0 && (
          <Box sx={{ mb: 0.75, px: 0.5 }}>
            <Box sx={{ height: 8, bgcolor: "#27272a", borderRadius: "999px", overflow: "hidden", display: "flex", border: 1, borderColor: "#3f3f4680" }}>
              <Box sx={{ height: "100%", bgcolor: "#3B82F6", transition: "width 0.5s" }} style={{ width: `${stablePct}%` }} title={`Stable: ${stablePct}%`} />
              <Box sx={{ height: "100%", bgcolor: "#A855F7", transition: "width 0.5s" }} style={{ width: `${canaryPct}%` }} title={`Canary: ${canaryPct}%`} />
            </Box>
          </Box>
        )}

        {metrics && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 1, py: 0.75, borderTop: 1, borderColor: "#3f3f4670", bgcolor: "rgba(0,0,0,0.3)", borderRadius: "0 0 4px 4px", mx: -1.5, mb: -1.5, mt: 0.5 }}>
            <Box sx={{ flex: 1 }} title={`CPU: ${Math.round(metrics.cpuPercent)}%`}>
              <LinearProgress
                variant="determinate"
                value={Math.min(Math.max(metrics.cpuPercent, 0), 100)}
                sx={{
                  height: 6, borderRadius: "999px", bgcolor: "#3f3f46",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: metrics.cpuPercent > 80 ? "#EF4444" : metrics.cpuPercent > 60 ? "#F97316" : "#3B82F6",
                    borderRadius: "999px",
                  },
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 8, fontFamily: "monospace", color: "#71717a", display: "block", mt: 0.25 }}>
                CPU
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} title={`MEM: ${Math.round(metrics.memoryPercent)}%`}>
              <LinearProgress
                variant="determinate"
                value={Math.min(Math.max(metrics.memoryPercent, 0), 100)}
                sx={{
                  height: 6, borderRadius: "999px", bgcolor: "#3f3f46",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: metrics.memoryPercent > 80 ? "#EF4444" : metrics.memoryPercent > 60 ? "#F97316" : "#22C55E",
                    borderRadius: "999px",
                  },
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 8, fontFamily: "monospace", color: "#71717a", display: "block", mt: 0.25 }}>
                MEM
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontSize: 9, fontFamily: "monospace", fontWeight: 500, color: "#a1a1aa", ml: "auto !important", flexShrink: 0 }}>
              {metrics.currentRPS.toLocaleString()}
              <Typography variant="caption" component="span" sx={{ color: "#52525b", fontSize: 9 }}> RPS</Typography>
            </Typography>
          </Stack>
        )}

        <ResizeHandle nodeId={nodeId} />
      </Box>
    </motion.div>
  );
}

export default memo(BaseNode);
