import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, LayoutTemplate, ChevronDown, GripVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { nodeRegistry } from "../../utils/nodeRegistry";
import type { NodeType } from "../../types/canvas";
import {
  Drawer, TextField, InputAdornment, Typography, Box, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";

const TEMPLATES = [
  { id: "simple-web-app", label: "Simple Web App", icon: "🌐", preview: "🌐 → 🖥 → 📦 → 🗄", desc: "4 nodes · 3 edges" },
  { id: "microservices", label: "Microservices", icon: "🧩", preview: "🚪 → 3× ⚙  → 🗄 + ⚡", desc: "6 nodes · 6 edges" },
  { id: "event-driven", label: "Event-Driven", icon: "📨", preview: "🌐 → 📨 → ⚙ → 🍃", desc: "4 nodes · 3 edges" },
  { id: "blue-green", label: "Blue/Green Deploy", icon: "🔄", preview: "⚖ → 🟦 + 🟩 → 🗄", desc: "4 nodes · 4 edges" },
] as const;

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
  icon: string;
  registryCats: string[];
}

const GROUPS: AccordionGroup[] = [
  { key: "network", label: "Network", icon: "🌐", registryCats: ["infrastructure", "network"] },
  { key: "compute", label: "Compute", icon: "🖥️", registryCats: ["compute"] },
  { key: "databases", label: "Databases", icon: "🗄️", registryCats: ["data"] },
  { key: "messaging", label: "Messaging", icon: "📨", registryCats: ["messaging"] },
  { key: "external", label: "External", icon: "☁️", registryCats: ["external"] },
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
        "&:hover": { bgcolor: "#27272a" },
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

interface NodePanelProps {
  onApplyTemplate?: (templateId: string) => void;
}

export default function NodePanel({ onApplyTemplate }: NodePanelProps) {
  const [query, setQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [accordionExpanded, setAccordionExpanded] = useState<Record<string, boolean>>(loadAccordionState);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

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
        persistWidth(sidebarWidth);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
  }, [sidebarWidth, persistWidth]);

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
    <Box sx={{ position: "relative", display: "flex", flexShrink: 0, height: "100%" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: sidebarWidth, boxSizing: "border-box", bgcolor: "#09090b",
            borderRight: 1, borderColor: "#27272a", overflow: "hidden",
            display: "flex", flexDirection: "column",
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "#27272a", flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.75 }}>
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
                sx: { fontSize: "0.75rem", color: "#a1a1aa", "&:before": { borderColor: "#3f3f46 !important" }, "&:after": { borderColor: "#22c55e !important" } },
              },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
          {GROUPS.map((grp) => {
            const items = grouped[grp.key];
            if (items.length === 0 && query) return null;
            const isExpanded = accordionExpanded[grp.key] ?? true;
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
                  borderColor: "#27272a",
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={14} style={{ color: "#52525b" }} />}
                  sx={{
                    minHeight: 36, px: 1.5, py: 0, "&.Mui-expanded": { minHeight: 36 },
                    "& .MuiAccordionSummary-content": { my: 0.5 },
                    "&:hover": { bgcolor: "#18181b" },
                    cursor: "pointer",
                  }}
                >
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.75, color: "#a1a1aa" }}>
                    <span>{grp.icon}</span> {grp.label}
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

        <Box sx={{ borderTop: 1, borderColor: "#27272a", px: 1.5, py: 1, flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 1, fontSize: "0.65rem" }}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <LayoutTemplate size={12} /> Templates
            </Box>
          </Typography>
          {TEMPLATES.map((tpl) => (
            <Card
              key={tpl.id}
              onClick={() => onApplyTemplate?.(tpl.id)}
              sx={{
                cursor: "pointer", mb: 1, bgcolor: "#18181b", border: "1px solid #27272a",
                transition: "border-color 0.15s, box-shadow 0.15s",
                "&:hover": { borderColor: "#22c55e", boxShadow: "0 0 0 1px rgba(34,197,94,0.15)" },
              }}
            >
              <CardContent sx={{ p: 1, "&:last-child": { pb: 1 }, display: "flex", alignItems: "center", gap: 1 }}>
                <Typography component="span" sx={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{tpl.icon}</Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: "#f4f4f5", fontSize: "0.65rem", display: "block" }}>{tpl.label}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: "0.55rem", color: "#52525b", display: "block", mt: 0.25 }}>{tpl.preview}</Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.5rem", color: "#3f3f46", display: "block", mt: 0.25 }}>{tpl.desc}</Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Drawer>

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
        <Box sx={{ width: 1.5, height: 24, borderRadius: 1, bgcolor: "#3f3f46", transition: "background 0.15s" }} />
      </Box>
    </Box>
  );
}
