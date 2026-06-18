import { memo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical } from "lucide-react";
import { Dialog, DialogTitle, DialogContent, Box } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";

interface FloatingFeaturePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  color: string;
  children: ReactNode;
}

export default memo(function FloatingFeaturePanel({
  open, onClose, title, color, children,
}: FloatingFeaturePanelProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(4px)",
            bgcolor: "rgba(5,5,7,0.6)",
          },
        },
        paper: {
          sx: {
            bgcolor: spatialTokens.bg.panel,
            backgroundImage: "none",
            border: `1px solid ${color}25`,
            borderRadius: "16px",
            boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 40px ${color}12`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: "60vh",
            maxHeight: "85vh",
          },
        },
      }}
    >
      <DialogTitle sx={{
        display: "flex", alignItems: "center", gap: 1,
        px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.06)",
        cursor: "default", flexShrink: 0,
      }}>
        <GripVertical size={13} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0, boxShadow: `0 0 6px ${color}60` }} />
        <Box sx={{ flex: 1, fontSize: "0.75rem", fontWeight: 600, color: "#EDEDEF", fontFamily: spatialTokens.font.ui }}>
          {title}
        </Box>
        <Box
          onClick={onClose}
          sx={{
            cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", p: 0.35,
            borderRadius: "4px", "&:hover": { color: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.06)" },
          }}
        >
          <X size={14} />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: "auto", minHeight: 0, "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { bgcolor: "#3f3f46", borderRadius: "4px" } }}>
        {children}
      </DialogContent>
    </Dialog>
  );
});
