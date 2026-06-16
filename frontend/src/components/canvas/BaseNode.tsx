import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { Skull, Globe, AlertTriangle, Circle } from "lucide-react";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { useChaosStore } from "../../store/chaosStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useDeployStore } from "../../store/deploymentStore";
import { useFinOpsStore } from "../../store/finopsStore";
import { useArchitectureStore } from "../../store/architectureStore";
import { NODE_COMPAT } from "../../store/exportStore";
import { spatialTokens } from "../../theme/spatialTokens";
import type { CanvasNode } from "../../types/canvas";
import type { BadgeType } from "../../store/architectureStore";
import { Box, Typography, Chip } from "@mui/material";

export type BaseNodeData = CanvasNode["data"];

export interface BaseNodeProps extends NodeProps<BaseNodeData> {
  children?: ReactNode;
}

const BADGE_META: Record<BadgeType, { icon: string; label: string; bg: string; border: string; glow: string }> = {
  "zero-trust": { icon: "\uD83D\uDEE1\uFE0F", label: "Zero-Trust Applied", bg: "rgba(20,184,166,0.2)", border: "rgba(20,184,166,0.4)", glow: "rgba(20,184,166,0.3)" },
  "edge-optimized": { icon: "\u26A1", label: "Edge-Optimized", bg: "rgba(34,197,94,0.2)", border: "rgba(34,197,94,0.4)", glow: "rgba(34,197,94,0.3)" },
  "ai-ready": { icon: "\uD83E\uDD16", label: "AI-Ready", bg: "rgba(168,85,247,0.2)", border: "rgba(168,85,247,0.4)", glow: "rgba(168,85,247,0.3)" },
};

const MIN_W = 180;
const MIN_H = 80;
const DEFAULT_W = 220;
const DEFAULT_H = 120;

const handleStyle: React.CSSProperties = {
  opacity: 0, transition: "opacity 0.2s",
  width: 10, height: 10,
  borderWidth: 2, borderColor: "rgba(99,102,241,0.4)", background: "rgba(20,20,24,0.9)",
  zIndex: 20,
};

function ResizeHandle({ nodeId }: { nodeId: string }) {
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      setResizing(true);
      const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      const rawW = node?.style?.width;
      const rawH = node?.style?.height;
      startRef.current = {
        x: e.clientX, y: e.clientY,
        w: typeof rawW === "number" ? rawW : DEFAULT_W,
        h: typeof rawH === "number" ? rawH : DEFAULT_H,
      };
      const onMove = (ev: PointerEvent) => {
        const dw = ev.clientX - startRef.current.x;
        const dh = ev.clientY - startRef.current.y;
        resizeNode(nodeId, Math.max(MIN_W, startRef.current.w + dw), Math.max(MIN_H, startRef.current.h + dh));
      };
      const onUp = () => { setResizing(false); document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
      document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
    },
    [nodeId, resizeNode],
  );

  return (
    <Box
      onPointerDown={onPointerDown}
      sx={{ position: "absolute", bottom: 0, right: 0, zIndex: 30, cursor: "nwse-resize", opacity: 0, transition: "opacity 0.2s", "&:hover": { opacity: 1 }, touchAction: "none" }}
      style={resizing ? { opacity: 1 } : undefined}
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M12 0v12H0l4-4h4V4l4-4z" fill="rgba(99,102,241,0.4)" stroke="rgba(99,102,241,0.6)" strokeWidth="0.5" />
      </svg>
    </Box>
  );
}

function DiegeticArc({ value, color, size = 36 }: { value: number; color: string; size?: number }) {
  const center = size / 2;
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ position: "absolute", top: -4, left: -4, pointerEvents: "none", transform: "rotate(-90deg)" }}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
      <circle cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function DiegeticBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <Box sx={{ height: 3, borderRadius: "999px", background: "rgba(255,255,255,0.06)", overflow: "hidden", flex: 1 }}>
      <Box sx={{ height: "100%", borderRadius: "999px", width: `${pct}%`, bgcolor: color, boxShadow: `0 0 6px ${color}` }} />
    </Box>
  );
}

function BaseNode({ id, data, selected, isConnectable, children }: BaseNodeProps) {
  const nodeType = data?.nodeType;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : null;

  if (!meta) {
    return (
      <Box sx={{ bgcolor: "rgba(127,29,29,0.3)", borderRadius: "16px", px: 1.5, py: 1, fontSize: "10px", color: spatialTokens.accent.error, border: spatialTokens.border.error }}>
        Unknown
      </Box>
    );
  }

  const [hovered, setHovered] = useState(false);
  const [pulseScale, setPulseScale] = useState(1);
  const prevDeployKey = useRef("");
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
  const bgBorderColor = deployStrategy === "blue_green" && bgActiveGroup === "green" ? spatialTokens.accent.success : deployStrategy === "blue_green" && bgActiveGroup === "blue" ? "#3B82F6" : null;
  const hasChaos = useChaosStore((s) => s.activeNodeIds.includes(nodeId));
  const isFastBurn = useCanvasStore((s) => s.fastBurnNodeIds.includes(nodeId));
  const exportMode = useCanvasStore((s) => s.exportMode);
  const compatStatus = NODE_COMPAT[nodeType] ?? "skipped";
  const nodeCostMonthly = useFinOpsStore((s) => {
    const entry = s.nodeCosts.find((c) => c.nodeId === id);
    return entry?.monthlyCost ?? 0;
  });
  const finOpsEntry = nodeCostMonthly > 0 ? { monthlyCost: nodeCostMonthly } as const : null;
  const nodeBadges = useArchitectureStore((s) => s.nodeBadges[nodeId]) ?? [];
  const nw = useCanvasStore((s) => {
    const n = s.nodes.find((n) => n.id === nodeId); const raw = n?.style?.width; return typeof raw === "number" ? raw : undefined;
  });
  const nh = useCanvasStore((s) => {
    const n = s.nodes.find((n) => n.id === nodeId); const raw = n?.style?.height; return typeof raw === "number" ? raw : undefined;
  });
  const dimStyle = nw || nh ? { width: nw ?? DEFAULT_W, height: nh ?? undefined } : undefined;

  useEffect(() => {
    const key = `${deployStrategy}-${bgActiveGroup}-${isCanary}`;
    if (key !== prevDeployKey.current && prevDeployKey.current !== "") {
      setPulseScale(1.05);
      const t = setTimeout(() => setPulseScale(1), 300);
      return () => clearTimeout(t);
    }
    prevDeployKey.current = key;
  }, [deployStrategy, bgActiveGroup, isCanary]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: pulseScale }}
      transition={spatialTokens.animation.spring as any}
      style={{ position: "relative", ...dimStyle }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} style={{ ...handleStyle, opacity: hovered ? 1 : 0 }} />

      {isFastBurn && !isFailed && (
        <Box sx={{ position: "absolute", inset: 0, zIndex: 12, pointerEvents: "none", borderRadius: "16px",
          background: "radial-gradient(circle at 50% 50%, transparent 40%, rgba(239,68,68,0.25) 100%)",
          animation: "pulse-red 1.5s ease-in-out infinite",
        }} />
      )}

      {nodeBadges.length > 0 && (
        <Box sx={{ position: "absolute", top: -8, right: -8, zIndex: 20, display: "flex", gap: 0.25 }}>
          {nodeBadges.map((badge) => {
            const bmeta = BADGE_META[badge];
            return (
              <Box key={badge} title={bmeta?.label ?? badge}
                sx={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, lineHeight: 1,
                  bgcolor: bmeta?.bg ?? "rgba(0,0,0,0.6)", border: 1, borderColor: bmeta?.border ?? "rgba(255,255,255,0.15)",
                  boxShadow: `0 0 6px ${bmeta?.glow ?? "rgba(255,255,255,0.1)"}`, backdropFilter: "blur(4px)",
                }}
              >{bmeta?.icon ?? "?"}</Box>
            );
          })}
        </Box>
      )}

      {finOpsEntry && (
        <Box sx={{ position: "absolute", bottom: -4, right: -4, zIndex: 20,
          bgcolor: "rgba(0,128,0,0.5)", fontSize: 9, fontFamily: spatialTokens.font.mono,
          px: 0.75, py: 0.25, borderRadius: "999px", border: 1, borderColor: "rgba(34,197,94,0.4)",
          boxShadow: 2, backdropFilter: "blur(4px)", color: spatialTokens.accent.success,
        }}>${finOpsEntry.monthlyCost.toFixed(0)}/mo</Box>
      )}

      {hasChaos && !isFailed && (
        <Box sx={{ position: "absolute", top: -8, right: -8, zIndex: 20 }} title="Chaos active">
          <Skull size={14} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))", color: "#fb923c" }} />
        </Box>
      )}

      {isBottleneck && !isFailed && (
        <Box sx={{ position: "absolute", top: -8, left: -8, zIndex: 20 }} title="Bottleneck detected">
          <Box sx={{ animation: "pulse-orange 1.4s ease-in-out infinite", display: "flex" }}>
            <AlertTriangle size={14} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))", color: "#fb923c" }} />
          </Box>
        </Box>
      )}

      {exportMode && (
        <Box sx={{ position: "absolute", top: -8, left: -8, zIndex: 20, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, border: 2, boxShadow: 2,
          bgcolor: compatStatus === "supported" ? "rgba(0,128,0,0.3)" : "rgba(128,0,0,0.3)",
          borderColor: compatStatus === "supported" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
        }}>
          {compatStatus === "supported" ? "\u2713" : "\u2298"}
        </Box>
      )}

      <Box sx={{
        borderRadius: "16px",
        bgcolor: isFailed ? spatialTokens.bg.island : spatialTokens.bg.island,
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: "1px solid",
        borderColor: isFailed ? spatialTokens.accent.error : selected ? spatialTokens.accent.primary : bgBorderColor ? bgBorderColor : "rgba(255,255,255,0.08)",
        boxShadow: isFailed ? spatialTokens.shadow.error : selected ? spatialTokens.shadow.glow : "0 4px 12px rgba(0, 0, 0, 0.5)",
        opacity: isFailed ? 0.85 : 1,
        transition: "border-color 0.2s, box-shadow 0.2s",
        overflow: "hidden",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.25 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}
            style={{ backgroundColor: `${meta.color}18` }}>
            <meta.icon size={16} color={meta.color} />
            {metrics && !isFailed && (
              <DiegeticArc value={metrics.cpuPercent} color={meta.color} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap sx={{ display: "block", lineHeight: 1.3, color: isFailed ? spatialTokens.accent.error : spatialTokens.text.primary, fontSize: "0.7rem", fontWeight: 600 }}>
              {isFailed ? "FAILED" : label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.15 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, bgcolor: meta.color, boxShadow: `0 0 4px ${meta.color}` }} />
              <Typography variant="caption" sx={{ fontSize: "0.45rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: spatialTokens.text.secondary }}>
                {meta.category}
              </Typography>
              {isPublic && <Globe size={10} color="#60a5fa" />}
            </Box>
          </Box>
        </Box>

        <Box sx={{ height: "1px", bgcolor: "rgba(255,255,255,0.06)", mx: 1.5 }} />

        <Box sx={{ px: 1.5, py: 1 }}>
          {isFailed && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, py: 0.5, boxShadow: "inset 0 0 20px rgba(239,68,68,0.15)", borderRadius: "8px" }}>
              <Skull size={16} color={spatialTokens.accent.error} />
              <Typography variant="caption" sx={{ fontSize: "0.6rem", color: spatialTokens.accent.error, fontWeight: 600 }}>CRITICAL FAILURE</Typography>
            </Box>
          )}

          {children}

          {(deployStrategy === "blue_green" || isCanary) && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 0.5 }}>
              {deployStrategy === "blue_green" && bgActiveGroup && (
                <Chip size="small" icon={<Circle size={7} style={{ fill: "currentColor" }} />}
                  label={bgActiveGroup === "blue" ? "Blue" : "Green"}
                  sx={{ height: 16, fontSize: "0.45rem",
                    bgcolor: bgActiveGroup === "blue" ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)",
                    color: bgActiveGroup === "blue" ? "#60a5fa" : spatialTokens.accent.success,
                    border: 1, borderColor: bgActiveGroup === "blue" ? "rgba(59,130,246,0.2)" : "rgba(34,197,94,0.2)",
                    "& .MuiChip-icon": { ml: 0.25 },
                  }}
                />
              )}
              {isCanary && (
                <Chip size="small" label={config.deployment.canaryVersion || "v2"}
                  sx={{ height: 16, fontSize: "0.45rem", bgcolor: "rgba(168,85,247,0.12)", color: spatialTokens.accent.purple, border: "1px solid rgba(168,85,247,0.2)" }}
                />
              )}
              {isCanaryFailing && (
                <Chip size="small" icon={<AlertTriangle size={9} />} label="Failing" color="error"
                  sx={{ height: 16, fontSize: "0.45rem", animation: "chaos-flash 1.5s ease-in-out infinite" }}
                />
              )}
            </Box>
          )}

          {deployStrategy === "canary" && totalRPS > 0 && (
            <Box sx={{ mb: 0.5 }}>
              <Box sx={{ height: 6, bgcolor: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden", display: "flex" }}>
                <Box sx={{ height: "100%", bgcolor: "#3B82F6", transition: "width 0.5s" }} style={{ width: `${stablePct}%` }} />
                <Box sx={{ height: "100%", bgcolor: spatialTokens.accent.purple, transition: "width 0.5s" }} style={{ width: `${canaryPct}%` }} />
              </Box>
            </Box>
          )}

          {metrics && !isFailed && (
            <Box sx={{ display: "flex", gap: 1, pt: 0.5, alignItems: "center" }}>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.4rem", color: spatialTokens.text.secondary, fontWeight: 500, width: 22 }}>CPU</Typography>
                  <DiegeticBar value={metrics.cpuPercent} color={spatialTokens.metrics.cpu} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: "0.4rem", color: spatialTokens.text.secondary, fontWeight: 500, width: 22 }}>MEM</Typography>
                  <DiegeticBar value={metrics.memoryPercent} color={spatialTokens.metrics.memory} />
                </Box>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0, ml: 1 }}>
                <Typography variant="caption" sx={{ fontSize: "0.55rem", fontFamily: spatialTokens.font.mono, fontWeight: 600, color: spatialTokens.metrics.rps, lineHeight: 1, display: "block" }}>
                  {metrics.currentRPS.toLocaleString()} <Typography component="span" sx={{ fontSize: "0.4rem", fontFamily: "inherit", color: spatialTokens.text.secondary, fontWeight: 400 }}>RPS</Typography>
                </Typography>
                {metrics.queueDepth > 0 && (
                  <Typography variant="caption" sx={{ fontSize: "0.45rem", fontFamily: spatialTokens.font.mono, fontWeight: 500, color: metrics.queueDepth > 100 ? spatialTokens.accent.error : spatialTokens.text.secondary, lineHeight: 1.4, display: "block" }}>
                    Q: {metrics.queueDepth}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>

        <ResizeHandle nodeId={nodeId} />
      </Box>
    </motion.div>
  );
}

export default memo(BaseNode);
