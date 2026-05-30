import { useEffect, useState, useCallback } from "react";
import { Monitor, Zap, Rocket, Shield, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, Tab, Box } from "@mui/material";
import NodeConfigPanel from "./NodeConfigPanel";
import SimulationPanel from "./SimulationPanel";
import ChaosPanel from "./ChaosPanel";
import DeploymentPanel from "./DeploymentPanel";
import SecurityPanel from "./SecurityPanel";
import FinOpsPanel from "./FinOpsPanel";
import { useCanvasStore, type RightTab } from "../../store/canvasStore";

interface UnifiedRightPanelProps {
  onSimStart: () => void;
  onSimStop: () => void;
}

const TAB_KEYS: RightTab[] = ["config", "simulate", "deploy", "security", "finops"];

const ICONS = [Monitor, Zap, Rocket, Shield, DollarSign];

export default function UnifiedRightPanel({ onSimStart, onSimStop }: UnifiedRightPanelProps) {
  const activeRightTab = useCanvasStore((s) => s.activeRightTab);
  const lastAutoTab = useCanvasStore((s) => s.lastAutoTab);
  const setActiveRightTabManual = useCanvasStore((s) => s.setActiveRightTabManual);
  const clearAutoTab = useCanvasStore((s) => s.clearAutoTab);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);

  const tabIndex = TAB_KEYS.indexOf(activeRightTab);
  const [pulsingTab, setPulsingTab] = useState<number | null>(null);

  useEffect(() => {
    if (lastAutoTab && lastAutoTab === activeRightTab) {
      const idx = TAB_KEYS.indexOf(lastAutoTab);
      setPulsingTab(idx);
      const timer = setTimeout(() => {
        setPulsingTab(null);
        clearAutoTab();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [lastAutoTab, activeRightTab, clearAutoTab]);

  const handleTabChange = useCallback(
    (_: any, idx: number) => setActiveRightTabManual(TAB_KEYS[idx]),
    [setActiveRightTabManual],
  );

  const renderContent = () => {
    switch (activeRightTab) {
      case "config":
        if (!selectedNodeId && !selectedEdgeId) {
          return (
            <Box sx={{ p: 2, textAlign: "center", mt: 4, color: "text.disabled", fontSize: "0.75rem" }}>
              Select a node or edge to configure
            </Box>
          );
        }
        return <NodeConfigPanel />;
      case "simulate":
        return (
          <Box sx={{ overflow: "auto", height: "100%" }}>
            <SimulationPanel onStart={onSimStart} onStop={onSimStop} />
            <ChaosPanel />
          </Box>
        );
      case "deploy":
        return <DeploymentPanel />;
      case "security":
        return <SecurityPanel />;
      case "finops":
        return <FinOpsPanel />;
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        width: 360,
        height: "100%",
        flexShrink: 0,
        bgcolor: "background.paper",
        borderLeft: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            minHeight: 48,
            borderBottom: 1, borderColor: "divider",
            "& .MuiTab-root": { minHeight: 48, fontSize: "0.6rem", color: "#71717a", textTransform: "none", py: 0 },
            "& .Mui-selected": { color: "#f4f4f5" },
            "& .MuiTabs-indicator": { bgcolor: "#f4f4f5" },
          }}
        >
          {TAB_KEYS.map((key, i) => {
            const Icon = ICONS[i];
            return (
              <Tab
                key={key}
                icon={
                  <motion.div
                    animate={pulsingTab === i ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeInOut", repeat: pulsingTab === i ? 2 : 0 }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: "flex",
                        borderRadius: "50%",
                        boxShadow: pulsingTab === i ? "0 0 10px 3px rgba(255,255,255,0.25)" : "none",
                        transition: "box-shadow 0.3s",
                      }}
                    >
                      <Icon size={14} />
                    </Box>
                  </motion.div>
                }
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                iconPosition="start"
              />
            );
          })}
        </Tabs>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRightTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{ height: "100%" }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </Box>
    </Box>
  );
}
