import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Dialog, TextField, List, ListItemButton, ListItemText, ListItemIcon,
  Box, Typography, Divider,
} from "@mui/material";
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
  const listRef = useRef<HTMLUListElement>(null);

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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { bgcolor: "rgba(0,0,0,0.5)" } },
        paper: {
          sx: {
            bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
            borderRadius: 0, boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            overflow: "hidden", mt: "-15vh",
          },
        },
      }}
    >
      <TextField
        inputRef={inputRef}
        placeholder="Type a command…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
        onKeyDown={handleKeyDown}
        variant="standard"
        fullWidth
        sx={{
          px: 2.5, py: 2,
          "& .MuiInput-root:before, & .MuiInput-root:after": { display: "none" },
          "& input": {
            fontSize: "1rem", color: "text.primary", fontFamily: '"Inter", sans-serif',
            "&::placeholder": { color: "#555558", opacity: 1 },
          },
        }}
      />
      <Divider sx={{ borderColor: "divider" }} />
      <Box sx={{ maxHeight: "50vh", overflow: "auto" }} ref={listRef}>
        {grouped.groups.length === 0 ? (
          <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 4, color: "text.secondary", fontSize: "0.7rem" }}>
            No matching commands
          </Typography>
        ) : (
          <List dense disablePadding>
            {(() => {
              let catIdx = -1;
              return grouped.groups.map((action, i) => {
                const isFirstInCat = i === 0 || grouped.groups[i - 1].category !== action.category;
                if (isFirstInCat) catIdx++;
                return (
                  <Box key={action.id}>
                    {isFirstInCat && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block", px: 2, pt: catIdx === 0 ? 1 : 1.5, pb: 0.25,
                          fontSize: "0.55rem", fontWeight: 600, color: "text.secondary",
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}
                      >
                        {action.category}
                      </Typography>
                    )}
                    <ListItemButton
                      selected={i === selectedIdx}
                      onClick={() => handleClick(action)}
                      sx={{
                        px: 2, py: 0.5, mx: 0.5, borderRadius: "4px",
                        "&.Mui-selected": { bgcolor: "rgba(99,102,241,0.12)" },
                        "&.Mui-selected:hover": { bgcolor: "rgba(99,102,241,0.16)" },
                        "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 24, mr: 1, color: "text.secondary", "& svg": { width: 14, height: 14 } }}>
                        {(() => { const Icon = CATEGORY_ICONS[action.category]; return <Icon />; })()}
                      </ListItemIcon>
                      <ListItemText
                        primary={action.label}
                        slotProps={{
                          primary: { sx: { fontSize: "0.75rem", fontWeight: 500, color: "text.primary" } },
                        }}
                      />
                    </ListItemButton>
                  </Box>
                );
              });
            })()}
          </List>
        )}
      </Box>
      <Divider sx={{ borderColor: "divider" }} />
      <Box sx={{ display: "flex", gap: 1.5, px: 2, py: 0.75, justifyContent: "flex-end" }}>
        <KeyHint icon={<CornerDownLeft size={12} />} desc="select" />
        <KeyHint icon={<><ArrowUp size={12} /><ArrowDown size={12} /></>} desc="navigate" />
        <KeyHint label="Esc" desc="close" />
      </Box>
    </Dialog>
  );
}

function KeyHint({ icon, label, desc }: { icon?: ReactNode; label?: string; desc: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      <Box
        sx={{
          fontSize: "0.55rem", color: "text.secondary",
          bgcolor: "background.elevated", px: 0.4, py: 0.15, borderRadius: "2px", lineHeight: 1.3,
          display: "flex", alignItems: "center", gap: 1,
        }}
      >
        {icon ?? label}
      </Box>
      <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "text.secondary" }}>{desc}</Typography>
    </Box>
  );
}

function NodesFirst(fn: (c: CommandCategory) => boolean): CommandCategory[] {
  const order: CommandCategory[] = ["Nodes", "Simulation", "Chaos", "Panels", "History", "Export"];
  return order.filter(fn);
}
