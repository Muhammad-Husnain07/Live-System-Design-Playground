import { memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Bomb, Trash2, Rocket } from "lucide-react";
import { Box, Typography } from "@mui/material";
import { useCanvasStore } from "../../store/canvasStore";
import { useChaosStore } from "../../store/chaosStore";
import { useDeployStore } from "../../store/deploymentStore";
import { spatialTokens } from "../../theme/spatialTokens";

interface RadialMenuProps {
  nodeId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

const SLICES = [
  { id: "config", label: "Config", icon: Settings, color: "#3B82F6", desc: "Configure node" },
  { id: "chaos", label: "Chaos", icon: Bomb, color: "#F59E0B", desc: "Inject failure" },
  { id: "delete", label: "Delete", icon: Trash2, color: "#EF4444", desc: "Remove node" },
  { id: "deploy", label: "Deploy", icon: Rocket, color: "#22C55E", desc: "Deployment settings" },
];

const R = 68;
const MENU_SIZE = R * 2 + 40;

const containerVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  exit: { opacity: 0, scale: 0, transition: spatialTokens.animation.spring },
};

const sliceVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: spatialTokens.animation.spring },
};

export default memo(function RadialMenu({ nodeId, position, onClose }: RadialMenuProps) {
  const selectNode = useCanvasStore((s) => s.selectNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const pushUndoState = useCanvasStore((s) => s.pushUndoState);
  const setActiveRightTab = useCanvasStore((s) => s.setActiveRightTab);
  const setShowChaosPanel = useChaosStore((s) => s.setShowChaosPanel);
  const setShowDeployPanel = useDeployStore((s) => s.setShowDeployPanel);

  const handleAction = useCallback(
    (actionId: string) => {
      if (!nodeId) return;
      switch (actionId) {
        case "config":
          selectNode(nodeId);
          setActiveRightTab("config");
          break;
        case "chaos":
          selectNode(nodeId);
          setActiveRightTab("simulate");
          setShowChaosPanel(true);
          break;
        case "delete":
          pushUndoState();
          removeNode(nodeId);
          break;
        case "deploy":
          selectNode(nodeId);
          setActiveRightTab("deploy");
          setShowDeployPanel(true);
          break;
      }
      onClose();
    },
    [nodeId, selectNode, removeNode, pushUndoState, setActiveRightTab, setShowChaosPanel, setShowDeployPanel, onClose],
  );

  return (
    <AnimatePresence>
      {nodeId && position && (
        <motion.div
          key="radial-menu"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "fixed",
            left: position.x - MENU_SIZE / 2,
            top: position.y - MENU_SIZE / 2,
            width: MENU_SIZE,
            height: MENU_SIZE,
            zIndex: spatialTokens.z.radialMenu,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: spatialTokens.bg.island,
            backdropFilter: "blur(16px) saturate(180%)",
            WebkitBackdropFilter: "blur(16px) saturate(180%)",
            border: spatialTokens.border.island,
            borderRadius: "50%",
            boxShadow: spatialTokens.shadow.elevation,
            pointerEvents: "auto",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              width: 8, height: 8,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.15)",
              pointerEvents: "none",
            }}
          />

          {SLICES.map((slice, i) => {
            const angle = (i / SLICES.length) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const cx = MENU_SIZE / 2 + R * Math.cos(rad);
            const cy = MENU_SIZE / 2 + R * Math.sin(rad);
            const Icon = slice.icon;
            return (
              <motion.button
                key={slice.id}
                variants={sliceVariants}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleAction(slice.id)}
                style={{
                  position: "absolute",
                  left: cx - 28,
                  top: cy - 28,
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  background: `${slice.color}18`,
                  borderColor: `${slice.color}40`,
                  transition: "all 0.15s ease",
                  color: slice.color,
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = `${slice.color}28`;
                  el.style.boxShadow = `0 0 16px ${slice.color}30`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = `${slice.color}18`;
                  el.style.boxShadow = "none";
                }}
              >
                <Icon size={18} strokeWidth={2} />
                <Typography
                  sx={{
                    fontSize: "8px",
                    fontWeight: 600,
                    lineHeight: 1,
                    color: slice.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    userSelect: "none",
                    fontFamily: spatialTokens.font.ui,
                  }}
                >
                  {slice.label}
                </Typography>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
