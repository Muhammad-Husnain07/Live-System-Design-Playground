import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical } from "lucide-react";
import { Box } from "@mui/material";
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
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    offsetRef.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newX = e.clientX - offsetRef.current.x;
      const newY = e.clientY - offsetRef.current.y;
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
      {open && (
        <motion.div
          key="floating-feature-panel"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={spatialTokens.animation.spring as any}
          style={{
            position: "fixed",
            left: pos.x || "50%",
            top: pos.y || "50%",
            transform: pos.x || pos.y ? undefined : "translate(-50%, -50%)",
            width: "80vw",
            maxWidth: 1000,
            height: "80vh",
            maxHeight: 800,
            zIndex: spatialTokens.z.modals,
            background: "rgba(5,5,7,0.94)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: `1px solid ${color}25`,
            borderRadius: "16px",
            boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px ${color}12`,
            pointerEvents: "auto",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            cursor: dragging ? "grabbing" : "default",
            userSelect: "none",
          }}
        >
          <Box
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              px: 2, py: 1.25,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              cursor: "grab", "&:active": { cursor: "grabbing" },
              flexShrink: 0,
            }}
          >
            <GripVertical size={13} style={{ color: spatialTokens.text.dim, flexShrink: 0 }} />
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0, boxShadow: `0 0 6px ${color}60` }} />
            <Box sx={{ flex: 1, fontSize: "0.75rem", fontWeight: 600, color: spatialTokens.text.primary, fontFamily: spatialTokens.font.ui }}>
              {title}
            </Box>
            <Box onClick={onClose} sx={{ cursor: "pointer", color: spatialTokens.text.dim, display: "flex", p: 0.35, borderRadius: "4px", "&:hover": { color: spatialTokens.text.primary, bgcolor: "rgba(255,255,255,0.06)" } }}>
              <X size={14} />
            </Box>
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {children}
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
