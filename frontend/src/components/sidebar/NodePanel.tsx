import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, ChevronDown, Globe, Monitor, Database, Inbox, Cloud, Zap, Cpu, Rocket, ArrowRight, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { nodeRegistry } from "../../utils/nodeRegistry";
import { ENTERPRISE_TEMPLATES, type EnterpriseTemplate } from "../../utils/enterpriseTemplates";
import { NodeCategory } from "../../types/canvas";
import {
  TextField, InputAdornment, Typography, Box, Chip,
  Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";

const ACCORDION_KEY = "sidebar-accordion";

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
  { key: "network", label: "Network", icon: Globe, registryCats: [NodeCategory.Infrastructure, NodeCategory.Network] },
  { key: "compute", label: "Compute", icon: Monitor, registryCats: [NodeCategory.Compute] },
  { key: "databases", label: "Databases", icon: Database, registryCats: [NodeCategory.Data] },
  { key: "messaging", label: "Messaging", icon: Inbox, registryCats: [NodeCategory.Messaging] },
  { key: "ai-ml", label: "AI / ML", icon: Cpu, registryCats: [NodeCategory.AIML] },
  { key: "modern", label: "Modern Compute", icon: Rocket, registryCats: [NodeCategory.ModernCompute] },
  { key: "external", label: "External", icon: Cloud, registryCats: [NodeCategory.External] },
];

const CATEGORY_COLORS: Record<string, string> = {
  [NodeCategory.Infrastructure]: "#3B82F6",
  [NodeCategory.Network]: "#A855F7",
  [NodeCategory.Data]: "#F97316",
  [NodeCategory.Messaging]: "#22C55E",
  [NodeCategory.Compute]: "#EC4899",
  [NodeCategory.External]: "#6B7280",
  [NodeCategory.AIML]: "#14B8A6",
  [NodeCategory.ModernCompute]: "#EAB308",
};

function createDragGhost(label: string, color: string) {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed;top:-9999px;left:-9999px",
    "display:flex;align-items:center;gap:8px",
    "padding:8px 14px",
    "background:rgba(20,20,21,0.92)",
    "backdrop-filter:blur(8px)",
    "border:1px solid rgba(99,102,241,0.3)",
    "border-radius:8px",
    "font-family:Inter,system-ui,sans-serif",
    "font-size:13px;font-weight:500;color:#EDEDEF",
    "white-space:nowrap;z-index:9999",
  ].join(";");
  el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span> ${label}`;
  document.body.appendChild(el);
  return el;
}

function DraggableNode({ type, label, icon: IconComponent, color }: { type: string; label: string; icon: LucideIcon; color: string }) {
  const onDragStart = useCallback((event: React.DragEvent) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "move";
    const ghost = createDragGhost(label, color);
    event.dataTransfer.setDragImage(ghost, 8, 8);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, [type, label, color]);

  return (
    <Box
      draggable
      onDragStart={onDragStart}
      sx={{
        display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 0.75, mx: 0.5, mb: 0.25,
        borderRadius: "6px", cursor: "grab", userSelect: "none",
        "&:hover": { bgcolor: "background.elevated" },
        "&:active": { cursor: "grabbing", bgcolor: "rgba(99,102,241,0.08)" },
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: color }} />
      <Typography sx={{ fontSize: "0.75rem", color: "text.primary", lineHeight: 1.2, flex: 1 }}>{label}</Typography>
      <Box sx={{ color: "text.disabled", opacity: 0.4, display: "flex", alignItems: "center" }}>
        <IconComponent size={12} />
      </Box>
    </Box>
  );
}

function TemplateCard({ template, onApply }: { template: EnterpriseTemplate; onApply: (id: string) => void }) {
  const Icon = template.icon;
  return (
    <Box
      onClick={() => onApply(template.id)}
      sx={{
        mx: 1, mb: 1, p: 1.5, borderRadius: 1.5,
        bgcolor: "transparent",
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "rgba(99,102,241,0.05)",
          boxShadow: "0 0 20px rgba(99,102,241,0.08)",
          "& .template-apply-icon": { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 1, bgcolor: "rgba(99,102,241,0.1)", flexShrink: 0, color: "primary.main" }}>
          <Icon size={16} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.primary", lineHeight: 1.3, mb: 0.25, display: "flex", alignItems: "center", gap: 0.5 }}>
            {template.label}
            <ArrowRight size={12} className="template-apply-icon" style={{ opacity: 0, transform: "translateX(-4px)", transition: "all 0.15s ease", marginLeft: "auto", flexShrink: 0 }} />
          </Typography>
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.4, mb: 0.75, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {template.desc}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {template.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: "0.55rem", bgcolor: "rgba(99,102,241,0.08)", color: "primary.light", fontWeight: 500, "& .MuiChip-label": { px: 0.75 } }} />
            ))}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 2, mt: 1, pt: 0.75, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Users size={10} style={{ color: "text.disabled" }} />
          <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", fontFamily: "monospace" }}>{template.totalInstances} instances</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Zap size={10} style={{ color: "text.disabled" }} />
          <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", fontFamily: "monospace" }}>{template.peakRPS.toLocaleString()} RPS</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function NodePanel({
  view,
  onApplyTemplate,
}: {
  view: "components" | "templates" | "search" | null;
  onApplyTemplate?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [accordionExpanded, setAccordionExpanded] = useState<Record<string, boolean>>(loadAccordionState);

  useEffect(() => {
    if (view !== "search") setQuery("");
  }, [view]);

  const toggleAccordion = useCallback((key: string) => {
    setAccordionExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(ACCORDION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const registry = useMemo(() => nodeRegistry, []);

  const grouped = useMemo(() => {
    const g: Record<string, { type: string; label: string; icon: LucideIcon; color: string }[]> = {};
    for (const grp of GROUPS) g[grp.key] = [];
    const q = query.toLowerCase().trim();
    for (const [type, entry] of Object.entries(registry)) {
      if (q && !entry.label.toLowerCase().includes(q) && !type.toLowerCase().includes(q)) continue;
      const grp = GROUPS.find((g) => g.registryCats.includes(entry.category));
      if (grp) g[grp.key].push({ type, label: entry.label, icon: entry.icon, color: entry.color });
    }
    return g;
  }, [registry, query]);

  const filteredTemplates = useMemo(() => {
    if (view !== "templates") return ENTERPRISE_TEMPLATES;
    const q = query.toLowerCase().trim();
    if (!q) return ENTERPRISE_TEMPLATES;
    return ENTERPRISE_TEMPLATES.filter(
      (t) => t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [view, query]);

  const showSearch = view === "components" || view === "templates";
  const showSearchBar = view === "search" || showSearch;

  return (
    <Box
      sx={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ p: 1.5, pb: showSearchBar ? 1 : 1.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 1, mb: showSearchBar ? 1 : 0, fontSize: "0.65rem" }}>
          {view === "templates" ? "Templates" : view === "search" ? "Search" : "Components"}
          <Typography component="span" sx={{ fontSize: "0.55rem", color: "text.disabled", fontFamily: "monospace", fontWeight: 400, textTransform: "none" }}>
            {view === "templates" ? ENTERPRISE_TEMPLATES.length : Object.keys(registry).length}
          </Typography>
        </Typography>
        {showSearchBar && (
          <TextField
            variant="standard"
            size="small"
            placeholder={view === "templates" ? "Search templates..." : "Search components..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} />
                  </InputAdornment>
                ),
                sx: { fontSize: "0.75rem", color: "text.secondary", bgcolor: "background.elevated", borderRadius: 1, px: 0.5, "&:before": { borderColor: "divider !important" }, "&:after": { borderColor: "primary.main !important" } },
              },
            }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, py: 0.5 }}>
        {view === "templates" ? (
          filteredTemplates.length > 0 ? (
            filteredTemplates.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} onApply={onApplyTemplate || (() => {})} />
            ))
          ) : (
            <Typography sx={{ p: 2, textAlign: "center", fontSize: "0.7rem", color: "text.disabled" }}>
              No templates match "{query}"
            </Typography>
          )
        ) : (
          GROUPS.map((grp) => {
            const items = grouped[grp.key];
            if (items.length === 0 && query) return null;
            const isExpanded = accordionExpanded[grp.key] ?? true;
            const groupColor = CATEGORY_COLORS[grp.registryCats[0]] || "#6B7280";
            return (
              <Accordion
                key={grp.key}
                expanded={isExpanded}
                onChange={() => toggleAccordion(grp.key)}
                disableGutters
                sx={{
                  bgcolor: "transparent", color: "text.primary", boxShadow: "none",
                  "&:before": { display: "none" },
                  "&.Mui-expanded": { my: 0 },
                  "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={14} style={{ color: "text.disabled" }} />}
                  sx={{
                    minHeight: 36, px: 1.5, py: 0, "&.Mui-expanded": { minHeight: 36 },
                    "& .MuiAccordionSummary-content": { my: 0.5 },
                    "&:hover": { bgcolor: "background.elevated" },
                    cursor: "pointer",
                  }}
                >
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: groupColor, flexShrink: 0 }} />
                    {grp.label}
                    <Typography component="span" sx={{ ml: 0.25, fontSize: "0.55rem", color: "text.disabled", fontFamily: "monospace" }}>
                      {items.length}
                    </Typography>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, pb: 0.5 }}>
                  {view === "search" ? (
                    query ? (
                      items.map((n) => (
                        <DraggableNode key={n.type} type={n.type} label={n.label} icon={n.icon} color={n.color} />
                      ))
                    ) : (
                      <Typography sx={{ p: 2, textAlign: "center", fontSize: "0.7rem", color: "text.disabled" }}>
                        Type to search all components
                      </Typography>
                    )
                  ) : (
                    items.map((n) => (
                      <DraggableNode key={n.type} type={n.type} label={n.label} icon={n.icon} color={n.color} />
                    ))
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>
    </Box>
  );
}
