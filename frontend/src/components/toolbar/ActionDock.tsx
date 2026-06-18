import { memo } from "react";
import { motion } from "framer-motion";
import { Skull, ShieldCheck, DollarSign, Download } from "lucide-react";
import { Box, Tooltip } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";

export type PanelId = "chaos" | "security" | "finops" | "export" | null;

interface ActionDockProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
}

const ITEMS: { id: PanelId; icon: typeof Skull; label: string; color: string }[] = [
  { id: "chaos", icon: Skull, label: "Chaos Engineering", color: "#F59E0B" },
  { id: "security", icon: ShieldCheck, label: "Security Analysis", color: "#3B82F6" },
  { id: "finops", icon: DollarSign, label: "Cost Estimation", color: "#22C55E" },
  { id: "export", icon: Download, label: "Export IaC", color: "#A855F7" },
];

export default memo(function ActionDock({ activePanel, onPanelChange }: ActionDockProps) {
  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: spatialTokens.z.actionDock,
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        background: "rgba(5,5,7,0.7)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: spatialTokens.border.island,
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        padding: "6px 10px",
        pointerEvents: "auto",
      }}
    >
      {ITEMS.map(({ id, icon: Icon, label, color }) => {
        const isActive = activePanel === id;
        return (
          <Tooltip key={id} title={label} arrow placement="top">
            <motion.button
              onClick={() => onPanelChange(isActive ? null : id)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                border: isActive ? `1px solid ${color}50` : "1px solid transparent",
                background: isActive ? `${color}18` : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: isActive ? color : "rgba(255,255,255,0.4)",
                outline: "none",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                }
              }}
            >
              <Icon size={16} strokeWidth={1.5} />
            </motion.button>
          </Tooltip>
        );
      })}
    </Box>
  );
});
