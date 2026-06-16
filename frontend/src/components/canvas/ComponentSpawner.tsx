import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Box, Typography } from "@mui/material";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { useCanvasStore } from "../../store/canvasStore";
import { getReactFlowType } from "../canvas/nodeTypes";
import { DEFAULT_SIM, DEFAULT_METRICS } from "../../utils/enterpriseTemplates";
import type { NodeType } from "../../types/canvas";
import type { Node } from "reactflow";

interface ComponentSpawnerProps {
  reactFlowInstance?: any;
}

const entries = Object.entries(NODE_REGISTRY);

export default memo(function ComponentSpawner({ reactFlowInstance }: ComponentSpawnerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const addNode = useCanvasStore((s) => s.addNode);
  const pushUndoState = useCanvasStore((s) => s.pushUndoState);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      ([nodeType, meta]) =>
        meta.label.toLowerCase().includes(q) ||
        nodeType.toLowerCase().includes(q) ||
        meta.category.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handleSelect = useCallback(
    (nodeType: string) => {
      const meta = NODE_REGISTRY[nodeType as NodeType];
      if (!meta) return;

      let x = 300, y = 200;
      if (reactFlowInstance) {
        const wrapper = document.querySelector(".react-flow") as HTMLElement;
        const w = wrapper?.clientWidth ?? 800;
        const h = wrapper?.clientHeight ?? 600;
        const center = reactFlowInstance.screenToFlowPosition({ x: w / 2, y: h / 3 });
        x = center.x;
        y = center.y;
      }

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: getReactFlowType(nodeType as NodeType),
        position: { x, y },
        style: { width: 220, height: 120 },
        data: {
          nodeType,
          label: meta.label,
          config: meta.defaultConfig,
          simulationState: DEFAULT_SIM,
          metrics: DEFAULT_METRICS,
        },
      };
      pushUndoState();
      addNode(newNode);
      handleClose();
    },
    [addNode, pushUndoState, handleClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        e.preventDefault();
        handleSelect(filtered[selectedIdx][0]);
      } else if (e.key === "Escape") {
        handleClose();
      }
    },
    [filtered, selectedIdx, handleSelect, handleClose],
  );

  return (
    <>
      {/* "+" Floating Island button */}
      <motion.button
        className="floating-island"
        onClick={handleOpen}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: "fixed",
          bottom: 24,
          left: 24,
          zIndex: 80,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1px solid rgba(99,102,241,0.4)",
          background: "rgba(20,20,24,0.85)",
          backdropFilter: "blur(16px) saturate(180%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#6366F1",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 24px rgba(99,102,241,0.25), 0 0 0 1px rgba(99,102,241,0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)";
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
      </motion.button>

      {/* Search palette */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="spawner-palette"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="floating-island"
            style={{
              position: "fixed",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 90,
              width: 360,
              maxHeight: 420,
              background: "rgba(20,20,24,0.92)",
              backdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
            }}
          >
            {/* Search input */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1.25,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Search size={14} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search components…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#EDEDEF",
                  fontSize: "0.75rem",
                  fontFamily: '"Inter", sans-serif',
                  fontWeight: 500,
                }}
              />
              <Box
                sx={{
                  fontSize: "0.5rem",
                  color: "rgba(255,255,255,0.2)",
                  fontFamily: '"Inter", sans-serif',
                  bgcolor: "rgba(255,255,255,0.04)",
                  px: 0.5,
                  py: 0.15,
                  borderRadius: "3px",
                  lineHeight: 1.4,
                }}
              >
                ESC
              </Box>
            </Box>

            {/* Results list */}
            <Box sx={{ overflow: "auto", flex: 1, py: 0.5 }}>
              {filtered.length === 0 ? (
                <Typography
                  sx={{
                    textAlign: "center",
                    py: 3,
                    fontSize: "0.65rem",
                    color: "rgba(255,255,255,0.25)",
                    fontFamily: '"Inter", sans-serif',
                  }}
                >
                  No matching components
                </Typography>
              ) : (
                filtered.map(([nodeType, meta], i) => {
                  const Icon = meta.icon;
                  return (
                    <Box
                      key={nodeType}
                      onClick={() => handleSelect(nodeType)}
                      onMouseEnter={() => setSelectedIdx(i)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 1.5,
                        py: 1,
                        cursor: "pointer",
                        bgcolor: i === selectedIdx ? "rgba(99,102,241,0.1)" : "transparent",
                        transition: "background 0.1s ease",
                        "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                      }}
                    >
                      <Box
                        sx={{
                          width: 28, height: 28,
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: `${meta.color}18`,
                          border: `1px solid ${meta.color}25`,
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={14} color={meta.color} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: "#EDEDEF",
                            fontFamily: '"Inter", sans-serif',
                            lineHeight: 1.3,
                          }}
                        >
                          {meta.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.6rem",
                            color: "rgba(255,255,255,0.35)",
                            fontFamily: '"Inter", sans-serif',
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {meta.description}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          fontSize: "0.5rem",
                          color: `${meta.color}80`,
                          fontFamily: '"JetBrains Mono", monospace',
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          bgcolor: `${meta.color}10`,
                          px: 0.6,
                          py: 0.2,
                          borderRadius: "3px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.category}
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>

            {/* Footer hints */}
            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                px: 1.5,
                py: 0.75,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                justifyContent: "flex-end",
              }}
            >
              <KeyHint icon={<CornerDownLeft size={11} />} desc="select" />
              <KeyHint icon={<><ArrowUp size={11} /><ArrowDown size={11} /></>} desc="navigate" />
              <KeyHint label="Esc" desc="close" />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

function KeyHint({ icon, label, desc }: { icon?: React.ReactNode; label?: string; desc: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <Box
        sx={{
          fontSize: "0.5rem",
          color: "rgba(255,255,255,0.3)",
          bgcolor: "rgba(255,255,255,0.04)",
          px: 0.4,
          py: 0.15,
          borderRadius: "3px",
          lineHeight: 1.3,
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {icon ?? label}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontSize: "0.5rem",
          color: "rgba(255,255,255,0.2)",
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {desc}
      </Typography>
    </Box>
  );
}
