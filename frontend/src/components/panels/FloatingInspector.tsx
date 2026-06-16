import { memo, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical, Lock, Unlock } from "lucide-react";
import { Box, Typography, Chip } from "@mui/material";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { spatialTokens } from "../../theme/spatialTokens";
import { useShallow } from "zustand/react/shallow";
import type { NodeType, NodeConfig } from "../../types/canvas";

const INSPECTOR_W = 220;

const editInputSx = {
  width: "100%", bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "4px", color: spatialTokens.text.primary, fontSize: "0.55rem",
  fontFamily: spatialTokens.font.mono, px: 0.5, py: 0.15, outline: "none",
  "&:focus": { borderColor: spatialTokens.accent.primary },
};

export default memo(function FloatingInspector() {
  const { selectedNodeId, selectNode, nodeType, label, cfg, metrics } = useCanvasStore(
    useShallow((s) => {
      const node = s.selectedNodeId ? s.nodes.find((n) => n.id === s.selectedNodeId) : null;
      const m = node?.data?.metrics;
      return {
        selectedNodeId: s.selectedNodeId,
        selectNode: s.selectNode,
        nodeType: (node?.data?.nodeType as NodeType | undefined) ?? null,
        label: node?.data?.label ?? null,
        cfg: node?.data?.config ?? null,
        metrics: m ? { currentRPS: m.currentRPS, cpuPercent: m.cpuPercent, memoryPercent: m.memoryPercent, errorRate: m.errorRate, latencyMs: m.latencyMs, queueDepth: m.queueDepth } : null,
      };
    }),
  );
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const pushUndoState = useCanvasStore((s) => s.pushUndoState);
  const meta = nodeType ? NODE_REGISTRY[nodeType] : undefined;
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 20, y: 80 });
  const [pos, setPos] = useState(posRef.current);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    offsetRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newX = Math.max(0, e.clientX - offsetRef.current.x);
      const newY = Math.max(0, e.clientY - offsetRef.current.y);
      posRef.current = { x: newX, y: newY };
      setPos({ x: newX, y: newY });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <AnimatePresence>
      {selectedNodeId && nodeType && meta && (
        <motion.div
          key="floating-inspector"
          className="floating-island"
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={spatialTokens.animation.spring as any}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: INSPECTOR_W,
            zIndex: spatialTokens.z.floatingPanels,
            pointerEvents: "auto",
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "default",
            userSelect: "none",
          }}
        >
          <Box
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            sx={{
              display: "flex", alignItems: "center", gap: 0.5,
              px: 1.5, py: 0.75,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              cursor: "grab", "&:active": { cursor: "grabbing" },
            }}
          >
            <GripVertical size={12} style={{ color: spatialTokens.text.dim, flexShrink: 0 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0, boxShadow: `0 0 6px ${meta.color}60` }} />
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: spatialTokens.text.primary, fontFamily: spatialTokens.font.ui, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label ?? meta.label}
              </Typography>
            </Box>
            <Box onClick={() => selectNode(null)} sx={{ cursor: "pointer", color: spatialTokens.text.dim, display: "flex", p: 0.25, borderRadius: "4px", "&:hover": { color: spatialTokens.text.primary, bgcolor: "rgba(255,255,255,0.06)" } }}>
              <X size={12} />
            </Box>
          </Box>

          <Box sx={{ px: 1.5, py: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Chip label={nodeType} size="small" sx={{ height: 16, fontSize: "0.45rem", bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 500 }} />
              {cfg?.region && <Typography sx={{ fontSize: "0.45rem", color: spatialTokens.text.secondary, fontFamily: spatialTokens.font.mono }}>{cfg.region}</Typography>}
              {cfg?.cloudProvider && <Typography sx={{ fontSize: "0.45rem", color: spatialTokens.text.secondary, fontFamily: spatialTokens.font.mono, textTransform: "uppercase" }}>{cfg.cloudProvider}</Typography>}
            </Box>

            {metrics && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                <CompactStat label="RPS" value={`${metrics.currentRPS ?? 0}`} color={spatialTokens.metrics.rps} />
                <CompactStat label="CPU" value={`${metrics.cpuPercent ?? 0}%`} color={spatialTokens.metrics.cpu} />
                <CompactStat label="MEM" value={`${metrics.memoryPercent ?? 0}%`} color={spatialTokens.metrics.memory} />
                <CompactStat label="ERR" value={`${metrics.errorRate ?? 0}%`} color={spatialTokens.metrics.error} />
                {metrics.latencyMs !== undefined && <CompactStat label="LAT" value={`${metrics.latencyMs}ms`} color={spatialTokens.metrics.latency} />}
              </Box>
            )}

            {cfg?.deployment?.strategy && (
              <Box sx={{ display: "flex", gap: 0.5, pt: 0.25 }}>
                <Chip label={cfg.deployment.strategy.replace("_", " ")} size="small" sx={{ height: 14, fontSize: "0.4rem", bgcolor: "rgba(99,102,241,0.12)", color: spatialTokens.accent.primary, fontWeight: 500 }} />
                <Chip label={`${cfg.instances ?? 1} instances`} size="small" sx={{ height: 14, fontSize: "0.4rem", bgcolor: "rgba(255,255,255,0.05)", color: spatialTokens.text.secondary }} />
                {cfg.autoScaling?.enabled && <Chip label="Auto" size="small" sx={{ height: 14, fontSize: "0.4rem", bgcolor: "rgba(34,197,94,0.12)", color: spatialTokens.accent.success }} />}
                {cfg.security?.isPublicFacing && <Chip label="Public" size="small" sx={{ height: 14, fontSize: "0.4rem", bgcolor: "rgba(239,68,68,0.12)", color: spatialTokens.accent.error }} />}
                {cfg.security?.vpcId && <Chip label={cfg.security.vpcId} size="small" sx={{ height: 14, fontSize: "0.4rem", bgcolor: "rgba(59,130,246,0.12)", color: "#60a5fa" }} />}
              </Box>
            )}

            <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", pt: 0.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography sx={{ fontSize: "0.4rem", color: spatialTokens.text.dim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                Config
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.45rem", color: spatialTokens.text.secondary, width: 36, flexShrink: 0 }}>Instances</Typography>
                <Box
                  component="input"
                  type="number"
                  defaultValue={cfg?.instances ?? 1}
                  min={1}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    const v = parseInt(e.target.value, 10);
                    if (v > 0 && v !== (cfg?.instances ?? 1)) {
                      pushUndoState();
                      updateNodeConfig(selectedNodeId!, { instances: v } as Partial<NodeConfig>);
                    }
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  sx={editInputSx}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.45rem", color: spatialTokens.text.secondary, width: 36, flexShrink: 0 }}>Max RPS</Typography>
                <Box
                  component="input"
                  type="number"
                  defaultValue={cfg?.maxRPS ?? 1000}
                  min={1}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    const v = parseInt(e.target.value, 10);
                    if (v > 0 && v !== (cfg?.maxRPS ?? 1000)) {
                      pushUndoState();
                      updateNodeConfig(selectedNodeId!, { maxRPS: v } as Partial<NodeConfig>);
                    }
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  sx={editInputSx}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.45rem", color: spatialTokens.text.secondary, width: 36, flexShrink: 0 }}>TLS</Typography>
                <Box
                  component="input"
                  type="checkbox"
                  defaultChecked={cfg?.security?.requiresTLS ?? true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    pushUndoState();
                    updateNodeConfig(selectedNodeId!, { security: { ...cfg?.security, requiresTLS: e.target.checked } } as any);
                  }}
                  sx={{ accentColor: spatialTokens.accent.primary, cursor: "pointer", width: 14, height: 14 }}
                />
                <Box sx={{ display: "flex", alignItems: "center", color: cfg?.security?.requiresTLS ? spatialTokens.accent.success : spatialTokens.accent.error, gap: 0.25 }}>
                  {cfg?.security?.requiresTLS ? <Lock size={10} /> : <Unlock size={10} />}
                  <Typography sx={{ fontSize: "0.45rem", fontFamily: spatialTokens.font.mono, color: cfg?.security?.requiresTLS ? spatialTokens.accent.success : spatialTokens.accent.error }}>
                    {cfg?.security?.requiresTLS ? "Enabled" : "Disabled"}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function CompactStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, bgcolor: "rgba(255,255,255,0.03)", borderRadius: "4px", px: 0.5, py: 0.15 }}>
      <Typography sx={{ fontSize: "0.4rem", color: spatialTokens.text.dim, fontFamily: spatialTokens.font.ui, fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.55rem", fontWeight: 600, color, fontFamily: spatialTokens.font.mono }}>{value}</Typography>
    </Box>
  );
}
