import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, ChevronDown, Globe, Monitor, Database, Inbox, Cloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { nodeRegistry } from "../../utils/nodeRegistry";
import {
  TextField, InputAdornment, Typography, Box,
  Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";

const SIDEBAR_WIDTH_KEY = "sidebarWidth";
const ACCORDION_KEY = "sidebar-accordion";

function loadSidebarWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (v) { const n = parseInt(v, 10); if (n >= 200 && n <= 400) return n; }
  } catch { }
  return 220;
}

function loadAccordionState(): Record<string, boolean> {
  try {
    const v = localStorage.getItem(ACCORDION_KEY);
    if (v) return JSON.parse(v);
  } catch { }
  return {};
}

interface AccordionGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  registryCats: string[];
}

const GROUPS: AccordionGroup[] = [
  { key: "network", label: "Network", icon: Globe, registryCats: ["infrastructure", "network"] },
  { key: "compute", label: "Compute", icon: Monitor, registryCats: ["compute"] },
  { key: "databases", label: "Databases", icon: Database, registryCats: ["data"] },
  { key: "messaging", label: "Messaging", icon: Inbox, registryCats: ["messaging"] },
  { key: "external", label: "External", icon: Cloud, registryCats: ["external"] },
];

function createDragGhost(label: string, iconEl: string) {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed;top:-9999px;left:-9999px",
    "display:flex;align-items:center;gap:8px",
    "padding:8px 14px",
    "background:#18181b",
    "border:1px solid #22c55e",
    "border-radius:8px",
    "box-shadow:0 4px 20px rgba(34,197,94,0.3)",
    "font-family:Inter,system-ui,sans-serif",
    "font-size:13px;font-weight:500;color:#f4f4f5",
    "white-space:nowrap;z-index:9999",
    "opacity:0.92",
  ].join(";");
  el.innerHTML = `${iconEl} ${label}`;
  document.body.appendChild(el);
  return el;
}

function DraggableNode({ type, label, icon: IconComponent }: { type: string; label: string; icon: LucideIcon }) {
  const onDragStart = useCallback((event: React.DragEvent) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "move";
    const ghost = createDragGhost(label, "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#22c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/></svg>");
    event.dataTransfer.setDragImage(ghost, 8, 8);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, [type, label]);

  return (
    <Box
      draggable
      onDragStart={onDragStart}
      sx={{
        display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 0.75, mx: 0.5, mb: 0.25,
        borderRadius: "6px", cursor: "grab", userSelect: "none",
        "&:hover": { bgcolor: "background.elevated" },
        "&:active": { cursor: "grabbing", bgcolor: "#1a1a2e" },
        "&:active .drag-node-icon": { color: "#22c55e" },
      }}
    >
      <Box className="drag-node-icon" sx={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#71717a", transition: "color 0.15s" }}>
        <IconComponent size={14} />
      </Box>
      <Typography sx={{ fontSize: "0.75rem", color: "#d4d4d8", lineHeight: 1.2 }}>{label}</Typography>
    </Box>
  );
}

export default function NodePanel() {
  const [query, setQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const sidebarWidthRef = useRef(sidebarWidth);
  const [accordionExpanded, setAccordionExpanded] = useState<Record<string, boolean>>(loadAccordionState);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);

  const persistWidth = useCallback((w: number) => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  }, []);

  const toggleAccordion = useCallback((key: string) => {
    setAccordionExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(ACCORDION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const delta = e.clientX - startX.current;
      const w = Math.min(400, Math.max(200, startW.current + delta));
      setSidebarWidth(w);
    };
    const onMouseUp = () => {
      if (resizing.current) {
        resizing.current = false;
        persistWidth(sidebarWidthRef.current);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
  }, [persistWidth]);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  const registry = useMemo(() => nodeRegistry, []);

  const grouped = useMemo(() => {
    const g: Record<string, { type: string; label: string; icon: LucideIcon }[]> = {};
    for (const grp of GROUPS) g[grp.key] = [];
    const q = query.toLowerCase().trim();
    for (const [type, entry] of Object.entries(registry)) {
      if (q && !entry.label.toLowerCase().includes(q) && !type.toLowerCase().includes(q)) continue;
      const grp = GROUPS.find((g) => g.registryCats.includes(entry.category));
      if (grp) g[grp.key].push({ type, label: entry.label, icon: entry.icon });
    }
    return g;
  }, [registry, query]);

  return (
    <Box
      sx={{
        width: sidebarWidth,
        height: "100%",
        flexShrink: 0,
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 1, fontSize: "0.65rem" }}>
            Components
          </Typography>
          <TextField
            variant="standard"
            size="small"
            placeholder="Search components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} />
                  </InputAdornment>
                ),
                sx: { fontSize: "0.75rem", color: "#a1a1aa", bgcolor: "background.elevated", borderRadius: 1, px: 0.5, "&:before": { borderColor: "#3f3f46 !important" }, "&:after": { borderColor: "#22c55e !important" } },
              },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
          {GROUPS.map((grp) => {
            const items = grouped[grp.key];
            if (items.length === 0 && query) return null;
            const isExpanded = accordionExpanded[grp.key] ?? true;
            const IconComponent = grp.icon;
            return (
              <Accordion
                key={grp.key}
                expanded={isExpanded}
                onChange={() => toggleAccordion(grp.key)}
                disableGutters
                sx={{
                  bgcolor: "transparent", color: "#d4d4d8", boxShadow: "none",
                  "&:before": { display: "none" },
                  "&.Mui-expanded": { my: 0 },
                  borderBottom: items.length > 0 ? "1px solid" : "none",
                  borderColor: "divider",
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={14} style={{ color: "#52525b" }} />}
                  sx={{
                    minHeight: 36, px: 1.5, py: 0, "&.Mui-expanded": { minHeight: 36 },
                    "& .MuiAccordionSummary-content": { my: 0.5 },
                    "&:hover": { bgcolor: "background.paper" },
                    cursor: "pointer",
                  }}
                >
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.75, color: "#a1a1aa" }}>
                    <IconComponent size={14} /> {grp.label}
                    <Typography component="span" sx={{ ml: 0.5, fontSize: "0.55rem", color: "#52525b", fontFamily: "monospace" }}>
                      {items.length}
                    </Typography>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, pb: 0.5 }}>
                  {items.map((n) => (
                    <DraggableNode key={n.type} type={n.type} label={n.label} icon={n.icon} />
                  ))}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      <Box
        onMouseDown={onHandleMouseDown}
        sx={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 4, zIndex: 10,
          cursor: "col-resize", bgcolor: "transparent",
          transition: "background 0.15s",
          "&:hover": { bgcolor: "#22c55e" },
          "&:active": { bgcolor: "#22c55e" },
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Box sx={{ width: 1.5, height: 24, borderRadius: 1, bgcolor: "divider", transition: "background 0.15s" }} />
      </Box>
    </Box>
  );
}
