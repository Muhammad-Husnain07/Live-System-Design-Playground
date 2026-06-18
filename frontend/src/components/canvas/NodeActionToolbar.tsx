import { memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Copy, Trash2 } from "lucide-react";
import { Box, Tooltip } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";
import { useCanvasStore } from "../../store/canvasStore";

const ACTIONS = [
  { id: "config", icon: Settings, label: "Config", color: "#3B82F6" },
  { id: "duplicate", icon: Copy, label: "Duplicate", color: "#22C55E" },
  { id: "delete", icon: Trash2, label: "Delete", color: "#EF4444" },
];

export default memo(function NodeActionToolbar() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const pushUndoState = useCanvasStore((s) => s.pushUndoState);
  const setActiveRightTab = useCanvasStore((s) => s.setActiveRightTab);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  const handleAction = useCallback(
    (actionId: string) => {
      if (!selectedNodeId) return;
      switch (actionId) {
        case "config":
          selectNode(selectedNodeId);
          setActiveRightTab("config");
          break;
        case "duplicate":
          pushUndoState();
          duplicateNode(selectedNodeId);
          break;
        case "delete":
          pushUndoState();
          removeNode(selectedNodeId);
          selectNode(null);
          break;
      }
    },
    [selectedNodeId, selectNode, removeNode, duplicateNode, pushUndoState, setActiveRightTab],
  );

  if (!selectedNode) return null;

  const nx = selectedNode.position.x;
  const ny = selectedNode.position.y;
  const nw = (selectedNode.style?.width as number) ?? 220;
  const sx = nx * viewport.zoom + viewport.x;
  const sy = ny * viewport.zoom + viewport.y;
  const sw = nw * viewport.zoom;
  const toolbarX = sx + sw / 2;
  const toolbarY = sy - 38;

  const buttonW = ACTIONS.length * 32 + (ACTIONS.length - 1) * 4 + 16;
  const clampedX = Math.max(8, Math.min(window.innerWidth - buttonW - 8, toolbarX - buttonW / 2));

  return (
    <AnimatePresence>
      <motion.div
        key="node-action-toolbar"
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          position: "fixed",
          left: clampedX,
          top: toolbarY,
          zIndex: spatialTokens.z.floatingPanel,
          pointerEvents: "auto",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            px: 1,
            py: 0.5,
            borderRadius: "10px",
            bgcolor: spatialTokens.bg.islandDarker,
            backdropFilter: "blur(16px) saturate(180%)",
            border: spatialTokens.border.island,
            boxShadow: spatialTokens.shadow.island,
          }}
        >
          {ACTIONS.map((act) => {
            const Icon = act.icon;
            return (
              <Tooltip key={act.id} title={act.label} arrow placement="top">
                <Box
                  onClick={() => handleAction(act.id)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: act.color,
                    bgcolor: `${act.color}12`,
                    border: `1px solid ${act.color}20`,
                    transition: "all 0.12s ease",
                    "&:hover": {
                      bgcolor: `${act.color}25`,
                      boxShadow: `0 0 12px ${act.color}30`,
                      transform: "scale(1.1)",
                    },
                    "&:active": {
                      transform: "scale(0.95)",
                    },
                  }}
                >
                  <Icon size={13} strokeWidth={2.5} />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </motion.div>
    </AnimatePresence>
  );
});
