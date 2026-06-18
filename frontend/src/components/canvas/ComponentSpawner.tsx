import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Box, Typography, Collapse } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import { NodeCategory } from "../../types/canvas";
import type { NodeType } from "../../types/canvas";

interface ComponentSpawnerProps {
  reactFlowInstance?: any;
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
}

const NODE_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: NodeCategory.Infrastructure, label: "Infrastructure", color: "#3B82F6" },
  { key: NodeCategory.Data, label: "Data", color: "#22C55E" },
  { key: NodeCategory.Network, label: "Network", color: "#14B8A6" },
  { key: NodeCategory.Messaging, label: "Messaging", color: "#F59E0B" },
  { key: NodeCategory.Compute, label: "Compute", color: "#A78BFA" },
  { key: NodeCategory.External, label: "External", color: "#6B7280" },
  { key: NodeCategory.AIML, label: "AI / ML", color: "#A855F7" },
  { key: NodeCategory.ModernCompute, label: "Modern Compute", color: "#06B6D4" },
];

const CATEGORY_DOT_COLORS: Record<string, string> = {
  [NodeCategory.Infrastructure]: "#3B82F6",
  [NodeCategory.Data]: "#22C55E",
  [NodeCategory.Network]: "#14B8A6",
  [NodeCategory.Messaging]: "#F59E0B",
  [NodeCategory.Compute]: "#A78BFA",
  [NodeCategory.External]: "#6B7280",
  [NodeCategory.AIML]: "#A855F7",
  [NodeCategory.ModernCompute]: "#06B6D4",
};

const entries = Object.entries(NODE_REGISTRY);

function groupByCategory(entriesArr: typeof entries): Map<string, typeof entriesArr> {
  const map = new Map<string, typeof entriesArr>();
  for (const [nodeType, meta] of entriesArr) {
    const cat = meta.category;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push([nodeType, meta] as [string, typeof meta]);
  }
  return map;
}

export default memo(function ComponentSpawner({ reactFlowInstance, wrapperRef }: ComponentSpawnerProps) {
  const [query, setQuery] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(NODE_CATEGORIES.map((c) => c.key)));
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dragGhostRef = useRef<HTMLDivElement>(null);

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

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!draggingType) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [draggingType]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, nodeType: string) => {
      e.dataTransfer.setData("application/node-type", nodeType);
      e.dataTransfer.effectAllowed = "move";
      setMousePos({ x: e.clientX, y: e.clientY });
      setDraggingType(nodeType);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingType(null);
  }, []);

  const sidebarW = 240;

  return (
    <>
      {/* Drag ghost portal */}
      <AnimatePresence>
        {draggingType && (
          <motion.div
            ref={dragGhostRef}
            key="drag-ghost"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: "fixed",
              pointerEvents: "none",
              zIndex: 99999,
              top: mousePos.y + 16,
              left: mousePos.x + 16,
            }}
          >
            <DragGhost nodeType={draggingType} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Box
        sx={{
          width: sidebarW,
          height: "100%",
          flexShrink: 0,
          bgcolor: spatialTokens.bg.panel,
          borderRight: 1,
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.7rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Components
          </Typography>
        </Box>

        {/* Search */}
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "background.elevated", borderRadius: "6px", px: 1, py: 0.5 }}>
            <Search size={12} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search components\u2026"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#EDEDEF",
                fontSize: "0.7rem",
                fontFamily: spatialTokens.font.ui,
              }}
            />
          </Box>
        </Box>

        {/* Accordion list */}
        <Box sx={{ flex: 1, overflow: "auto", py: 0.5 }}>
          {filtered.length === 0 ? (
            <Typography sx={{ textAlign: "center", py: 3, fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>
              No matching components
            </Typography>
          ) : query.trim() ? (
            /* Flat list when searching */
            filtered.map(([nodeType, meta]) => (
              <DraggableRow key={nodeType} nodeType={nodeType} meta={meta} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            ))
          ) : (
            /* Accordion groups */
            NODE_CATEGORIES.map((cat) => {
              const catEntries = grouped.get(cat.key);
              if (!catEntries || catEntries.length === 0) return null;
              const isExpanded = expandedCats.has(cat.key);
              return (
                <Box key={cat.key}>
                  <Box
                    onClick={() => toggleCategory(cat.key)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.75,
                      cursor: "pointer", userSelect: "none",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: cat.color, boxShadow: `0 0 4px ${cat.color}` }} />
                    <Typography variant="caption" sx={{ flex: 1, fontSize: "0.6rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {cat.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "text.disabled", fontFamily: spatialTokens.font.mono }}>
                      {catEntries.length}
                    </Typography>
                    {isExpanded ? <ChevronDown size={10} style={{ color: "rgba(255,255,255,0.2)" }} /> : <ChevronRight size={10} style={{ color: "rgba(255,255,255,0.2)" }} />}
                  </Box>
                  <Collapse in={isExpanded}>
                    {catEntries.map(([nodeType, meta]) => (
                      <DraggableRow key={nodeType} nodeType={nodeType} meta={meta} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                    ))}
                  </Collapse>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </>
  );
});

function DraggableRow({
  nodeType, meta, onDragStart, onDragEnd,
}: {
  nodeType: string;
  meta: (typeof NODE_REGISTRY)[NodeType];
  onDragStart: (e: React.DragEvent, nodeType: string) => void;
  onDragEnd: () => void;
}) {
  const Icon = meta.icon;
  return (
    <Box
      draggable
      onDragStart={(e) => onDragStart(e, nodeType)}
      onDragEnd={onDragEnd}
      sx={{
        display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
        cursor: "grab", userSelect: "none",
        transition: "background 0.1s ease",
        "&:hover": { bgcolor: "rgba(99,102,241,0.08)" },
        "&:active": { cursor: "grabbing", bgcolor: "rgba(99,102,241,0.12)" },
      }}
    >
      {/* Drag handle */}
      <Box
        sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.15)", flexShrink: 0, "&:hover": { color: "rgba(255,255,255,0.4)" } }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </Box>
      {/* Colored dot */}
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, bgcolor: meta.color, boxShadow: `0 0 4px ${meta.color}` }} />
      {/* Icon */}
      <Box sx={{ width: 20, height: 20, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, bgcolor: `${meta.color}18` }}>
        <Icon size={11} color={meta.color} />
      </Box>
      {/* Label */}
      <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 500, color: "#EDEDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
}

function DragGhost({ nodeType }: { nodeType: string }) {
  const meta = NODE_REGISTRY[nodeType as NodeType];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", gap: 1.5,
        px: 2, py: 1,
        borderRadius: "16px",
        bgcolor: "rgba(39,39,42,0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        whiteSpace: "nowrap",
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      <Box sx={{ width: 24, height: 24, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${meta.color}18` }}>
        <Icon size={13} color={meta.color} />
      </Box>
      <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#EDEDEF" }}>
        {meta.label}
      </Typography>
    </Box>
  );
}
