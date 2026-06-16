import { useCallback } from "react";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, Tab, Box, Typography } from "@mui/material";
import NodeConfigPanel from "./NodeConfigPanel";
import SimulationPanel from "./SimulationPanel";
import ChaosPanel from "./ChaosPanel";
import DeploymentPanel from "./DeploymentPanel";
import SecurityPanel from "./SecurityPanel";
import FinOpsPanel from "./FinOpsPanel";
import IncidentPanel from "./IncidentPanel";
import WaterfallPanel from "./WaterfallPanel";
import { useCanvasStore, type RightTab } from "../../store/canvasStore";

interface UnifiedRightPanelProps {
  onSimStart: () => void;
  onSimStop: () => void;
}

const TAB_KEYS: RightTab[] = ["config", "deploy", "security", "finops"];
const TAB_LABELS: Record<string, string> = { config: "Design", deploy: "Deploy", security: "Security", finops: "FinOps" };

export default function UnifiedRightPanel({ onSimStart, onSimStop }: UnifiedRightPanelProps) {
  const activeRightTab = useCanvasStore((s) => s.activeRightTab);
  const setActiveRightTabManual = useCanvasStore((s) => s.setActiveRightTabManual);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);

  const tabIndex = TAB_KEYS.indexOf(activeRightTab as any);

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
      case "incident":
        return <IncidentPanel />;
      case "waterfall":
        return <WaterfallPanel />;
      default:
        return null;
    }
  };

  const isSpecialTab = activeRightTab === "waterfall" || activeRightTab === "simulate" || activeRightTab === "incident";

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
      {isSpecialTab ? (
        <Box sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", px: 2 }}>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
            {activeRightTab === "waterfall" && <><Search size={12} /> Trace Waterfall</>}
            {activeRightTab === "simulate" && "Simulation"}
            {activeRightTab === "incident" && "Incident"}
          </Typography>
        </Box>
      ) : (
        <Tabs
          value={tabIndex >= 0 ? tabIndex : 0}
          onChange={handleTabChange}
          sx={{
            minHeight: 36,
            borderBottom: 1, borderColor: "divider",
            px: 1.5, pt: 0.5,
            "& .MuiTabs-flexContainer": { gap: 0.5 },
            "& .MuiTab-root": {
              minHeight: 28, py: 0, px: 1.5,
              fontSize: "0.65rem", fontWeight: 500,
              color: "text.disabled",
              textTransform: "none",
              minWidth: 0,
              borderRadius: "4px 4px 0 0",
              transition: "color 0.15s, background 0.15s",
              "&:hover": { color: "text.secondary", bgcolor: "background.elevated" },
              "&.Mui-selected": { color: "text.primary" },
            },
            "& .MuiTabs-indicator": { height: 2, bgcolor: "text.primary", borderRadius: "2px 2px 0 0" },
          }}
        >
          {TAB_KEYS.map((key) => (
            <Tab key={key} label={TAB_LABELS[key]} />
          ))}
        </Tabs>
      )}
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRightTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ height: "100%" }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
