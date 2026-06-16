import { memo, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical, Cpu, Zap, Activity } from "lucide-react";
import { Box, Typography } from "@mui/material";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { NodeType } from "../../types/canvas";

const INSPECTOR_W = 240;

export default memo(function FloatingInspector() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 20, y: 80 });
  const [pos, setPos] = useState(posRef.current);

  const nodeType = selectedNode?.data?.nodeType as NodeType | undefined;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : undefined;
  const metrics = selectedNode?.data?.metrics;
  const config = selectedNode?.data?.config;

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
      {selectedNode && nodeType && meta && (
        <motion.div
          key="floating-inspector"
          className="floating-island"
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: INSPECTOR_W,
            zIndex: 90,
            background: "rgba(20,20,24,0.88)",
            backdropFilter: "blur(16px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)${dragging ? ", 0 0 20px rgba(99,102,241,0.15)" : ""}`,
            pointerEvents: "auto",
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "default",
            transition: dragging ? "none" : "box-shadow 0.2s ease",
            userSelect: "none",
          }}
        >
          {/* Drag handle */}
          <Box
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.5,
              py: 1,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
            }}
          >
            <GripVertical size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 8, height: 8, borderRadius: "50%",
                  bgcolor: meta.color,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${meta.color}60`,
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: "#EDEDEF",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: '"Inter", sans-serif',
                }}
              >
                {selectedNode.data?.label ?? meta.label}
              </Typography>
            </Box>
            <Box
              onClick={() => selectNode(null)}
              sx={{
                cursor: "pointer",
                color: "rgba(255,255,255,0.25)",
                display: "flex",
                p: 0.25,
                borderRadius: "4px",
                "&:hover": { color: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <X size={12} />
            </Box>
          </Box>

          {/* Metrics */}
          <Box sx={{ px: 1.5, py: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            {metrics && (
              <>
                <MetricRow icon={Zap} label="RPS" value={`${metrics.currentRPS ?? 0} / ${config?.maxRPS ?? "-"}`} color="#34D399" />
                <MetricRow icon={Activity} label="Latency" value={`${metrics.latencyMs ?? 0}ms`} color="#60A5FA" />
                <MetricRow icon={Cpu} label="CPU" value={`${metrics.cpuUsage ?? 0}%`} color="#F59E0B" />
              </>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <Typography sx={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", fontFamily: '"JetBrains Mono", monospace' }}>
                {nodeType}
              </Typography>
              <Typography sx={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", fontFamily: '"JetBrains Mono", monospace' }}>
                {config?.region ?? "us-east-1"}
              </Typography>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function MetricRow({ icon: Icon, label, value, color }: { icon: typeof Zap; label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Icon size={10} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", fontFamily: '"Inter", sans-serif', minWidth: 40 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.65rem",
          fontWeight: 600,
          fontFamily: '"JetBrains Mono", monospace',
          color,
          ml: "auto",
          textShadow: `0 0 8px ${color}40`,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
