import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Typography } from "@mui/material";
import { spatialTokens } from "../../theme/spatialTokens";
import {
  Plus, Play, Bomb, PanelRight, Undo2, FileDown, CornerDownLeft, ArrowUp, ArrowDown,
  type LucideIcon,
} from "lucide-react";
import type { CommandAction, CommandCategory } from "../../utils/commandActions";

const CATEGORY_ICONS: Record<CommandCategory, LucideIcon> = {
  Nodes: Plus,
  Simulation: Play,
  Chaos: Bomb,
  Panels: PanelRight,
  History: Undo2,
  Export: FileDown,
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
  onExecute: (actionId: string) => void;
}

export default function CommandPalette({ open, onClose, actions, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = !q
      ? actions
      : actions.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.searchTerms.some((t) => t.toLowerCase().includes(q)) ||
            a.category.toLowerCase().includes(q),
        );
    const map = new Map<CommandCategory, CommandAction[]>();
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    const order: CommandCategory[] = NodesFirst(a => map.has(a));
    return { flat: filtered, groups: order.flatMap((c) => map.get(c) ?? []) };
  }, [actions, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, grouped.groups.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && grouped.groups[selectedIdx]) {
        e.preventDefault();
        onExecute(grouped.groups[selectedIdx].id);
        onClose();
      }
    },
    [grouped, selectedIdx, onExecute, onClose],
  );

  const handleClick = useCallback(
    (action: CommandAction) => {
      onExecute(action.id);
      onClose();
    },
    [onExecute, onClose],
  );

  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette"
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            position: "fixed",
            top: "25%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90vw",
            maxWidth: 520,
            zIndex: spatialTokens.z.palette,
            background: "rgba(10,10,11,0.94)",
            backdropFilter: "blur(28px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          {/* Search input */}
          <Box sx={{ px: 2, py: 1.75, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <Box
              component="input"
              ref={inputRef}
              placeholder="Type a command…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
              onKeyDown={handleKeyDown}
              sx={{
                width: "100%", border: "none", outline: "none", bgcolor: "transparent",
                fontSize: "0.9rem", fontFamily: spatialTokens.font.ui,
                color: "#EDEDEF", caretColor: "#6366F1",
                "&::placeholder": { color: "#555558", opacity: 1 },
              }}
            />
          </Box>

          {/* Results */}
          <Box
            ref={listRef}
            sx={{ maxHeight: "50vh", overflow: "auto" }}
          >
            {grouped.groups.length === 0 ? (
              <Typography sx={{ display: "block", textAlign: "center", py: 4, color: "#555558", fontSize: "0.7rem" }}>
                No matching commands
              </Typography>
            ) : (
              (() => {
                let catIdx = -1;
                return grouped.groups.map((action, i) => {
                  const isFirstInCat = i === 0 || grouped.groups[i - 1].category !== action.category;
                  if (isFirstInCat) catIdx++;
                  const isSelected = i === selectedIdx;
                  return (
                    <Box key={action.id}>
                      {isFirstInCat && (
                        <Typography
                          sx={{
                            display: "block", px: 2, pt: catIdx === 0 ? 1 : 1.5, pb: 0.25,
                            fontSize: "0.5rem", fontWeight: 600, color: "#555558",
                            textTransform: "uppercase", letterSpacing: "0.08em",
                          }}
                        >
                          {action.category}
                        </Typography>
                      )}
                      <Box
                        ref={isSelected ? selectedRef : undefined}
                        onClick={() => handleClick(action)}
                        sx={{
                          display: "flex", alignItems: "center", gap: 1.5,
                          px: 2, py: 0.6, mx: 0.75, borderRadius: "6px",
                          cursor: "pointer", userSelect: "none",
                          bgcolor: isSelected ? "rgba(99,102,241,0.12)" : "transparent",
                          border: isSelected ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
                          transition: "background 0.1s, border-color 0.1s",
                          "&:hover": { bgcolor: "rgba(99,102,241,0.08)" },
                        }}
                      >
                        <Box sx={{
                          width: 20, height: 20, borderRadius: "4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, color: "#8B8B8F",
                          bgcolor: isSelected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                          "& svg": { width: 12, height: 12 },
                        }}>
                          {(() => { const Icon = CATEGORY_ICONS[action.category]; return <Icon />; })()}
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: "0.72rem", fontWeight: 500, color: isSelected ? "#EDEDEF" : "#d4d4d8" }}>
                          {action.label}
                        </Typography>
                      </Box>
                    </Box>
                  );
                });
              })()
            )}
          </Box>

          {/* Footer hints */}
          <Box sx={{
            display: "flex", gap: 1.5, px: 2, py: 0.75,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            justifyContent: "flex-end",
          }}>
            <KeyHint icon={<CornerDownLeft size={11} />} desc="select" />
            <KeyHint icon={<><ArrowUp size={11} /><ArrowDown size={11} /></>} desc="navigate" />
            <KeyHint label="Esc" desc="close" />
          </Box>
        </motion.div>
      )}

      {/* Backdrop */}
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: spatialTokens.z.paletteBackdrop,
            background: "rgba(0,0,0,0.45)",
            pointerEvents: "auto",
          }}
        />
      )}
    </AnimatePresence>
  );
}

function KeyHint({ icon, label, desc }: { icon?: ReactNode; label?: string; desc: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <Box
        sx={{
          fontSize: "0.5rem", color: "#8B8B8F",
          bgcolor: "rgba(255,255,255,0.06)", px: 0.35, py: 0.15, borderRadius: "3px", lineHeight: 1.3,
          display: "flex", alignItems: "center", gap: 0.5,
        }}
      >
        {icon ?? label}
      </Box>
      <Typography sx={{ fontSize: "0.5rem", color: "#8B8B8F" }}>{desc}</Typography>
    </Box>
  );
}

function NodesFirst(fn: (c: CommandCategory) => boolean): CommandCategory[] {
  const order: CommandCategory[] = ["Nodes", "Simulation", "Chaos", "Panels", "History", "Export"];
  return order.filter(fn);
}
