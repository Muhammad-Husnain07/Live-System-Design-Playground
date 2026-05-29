import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { nodeRegistry } from "../../utils/nodeRegistry";
import { Drawer, TextField, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Box } from "@mui/material";

const DRAWER_WIDTH = 220;

type Category = "compute" | "storage" | "network" | "serverless" | "security" | "analytics" | "messaging" | "other";

const catLabels: Record<Category, string> = {
  compute: "Compute",
  storage: "Storage",
  network: "Network",
  serverless: "Serverless",
  security: "Security",
  analytics: "Analytics",
  messaging: "Messaging",
  other: "Other",
};

const catOrder: Category[] = ["compute", "storage", "network", "serverless", "security", "analytics", "messaging", "other"];

const categoryCache = new Map<string, Category>();
function getCategory(type: string): Category {
  const cached = categoryCache.get(type);
  if (cached) return cached;
  const t = type.toLowerCase();
  const ec2 = /\b(ec2|instance|compute|vm|server|lambda|container|eks|ecs|fargate|autoscaling|asg|spot|batch|gpu)\b/;
  const st = /\b(s3|bucket|ebs|efs|storage|disk|volume|fsx|backup|snapshot|glacier|dynamodb|table|cfs|blob)\b/;
  const net = /\b(vpc|subnet|alb|elb|nlb|gateway|route53|cdn|cloudfront|load.?balancer|firewall|waf|nat|eip|eni|acl|security.?group)\b/;
  const sl = /\b(lambda|function|api.?gateway|step.?function|sqs|sns|eventbridge|appsync|queue|topic)\b/;
  const sec = /\b(iam|role|policy|kms|certificate|secret|guardduty|inspector|shield|waf|identity)\b/;
  const anal = /\b(kinesis|redshift|athena|glue|emr|elasticsearch|opensearch|quicksight|data.?pipeline)\b/;
  const msg = /\b(sqs|sns|eventbridge|mq|kafka|msk|pub.?sub|queue|topic)\b/;

  if (ec2.test(t)) { categoryCache.set(type, "compute"); return "compute"; }
  if (st.test(t)) { categoryCache.set(type, "storage"); return "storage"; }
  if (net.test(t)) { categoryCache.set(type, "network"); return "network"; }
  if (sl.test(t)) { categoryCache.set(type, "serverless"); return "serverless"; }
  if (sec.test(t)) { categoryCache.set(type, "security"); return "security"; }
  if (anal.test(t)) { categoryCache.set(type, "analytics"); return "analytics"; }
  if (msg.test(t)) { categoryCache.set(type, "messaging"); return "messaging"; }
  categoryCache.set(type, "other");
  return "other";
}

function DraggableNode({ type, label, icon, category }: { type: string; label: string; icon: LucideIcon; category: Category }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, label, icon, category },
  });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 9999 }
    : undefined;

  const IconComponent = icon;

  return (
    <ListItem disablePadding ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ListItemButton
        dense
        sx={{
          borderRadius: "6px", mx: 0.5, mb: 0.25, py: 0.5, px: 1,
          bgcolor: isDragging ? "action.selected" : "transparent",
          opacity: isDragging ? 0.5 : 1,
          cursor: "grab",
          "&:hover": { bgcolor: "action.hover" },
          "&:active": { cursor: "grabbing" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <IconComponent size={16} />
        </ListItemIcon>
        <ListItemText primary={label} slotProps={{ primary: { sx: { fontSize: "0.75rem" }, noWrap: true } }} />
      </ListItemButton>
    </ListItem>
  );
}

export default function NodePanel() {
  const [query, setQuery] = useState("");
  const registry = useMemo(() => nodeRegistry, []);

  const grouped = useMemo(() => {
    const g: Record<Category, { type: string; label: string; icon: LucideIcon }[]> = {
      compute: [], storage: [], network: [], serverless: [],
      security: [], analytics: [], messaging: [], other: [],
    };
    const q = query.toLowerCase().trim();
    for (const [type, entry] of Object.entries(registry)) {
      if (q && !entry.label.toLowerCase().includes(q) && !type.toLowerCase().includes(q)) continue;
      const cat = getCategory(type);
      g[cat].push({ type, label: entry.label, icon: entry.icon });
    }
    return g;
  }, [registry, query]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", bgcolor: "#09090b", borderRight: 1, borderColor: "#27272a", overflowY: "auto" },
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "#27272a" }}>
        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.75 }}>
          Components
        </Typography>
        <TextField
          variant="standard"
          size="small"
          placeholder="Search nodes..."
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

      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {catOrder.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          return (
            <Box key={cat} sx={{ mb: 0.5 }}>
              <Typography variant="caption" sx={{ display: "block", px: 1.5, py: 0.5, fontWeight: 500, color: "text.disabled", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {catLabels[cat]}
              </Typography>
              <List dense disablePadding>
                {items.map((n) => (
                  <DraggableNode key={n.type} type={n.type} label={n.label} icon={n.icon} category={cat} />
                ))}
              </List>
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
}
