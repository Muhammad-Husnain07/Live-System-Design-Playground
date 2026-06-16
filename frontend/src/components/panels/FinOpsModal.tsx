import { useState } from "react";
import { motion } from "framer-motion";
import { useCanvasStore } from "../../store/canvasStore";
import { useFinOpsStore } from "../../store/finopsStore";
import { useToastStore } from "../../store/toastStore";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Box, Typography, Button, ButtonGroup } from "@mui/material";
import { X, DollarSign, ChevronUp, ChevronDown } from "lucide-react";

const USER_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "10K", value: 10_000 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
];

const DONUT_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#eab308"];

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#2A2A2E" };
const CHART_TICK = { fontSize: 9, fill: "#8B8B8F" };
const CHART_TOOLTIP = { contentStyle: { background: "#141415", border: "1px solid #3E3E44", borderRadius: 8, fontSize: 11 } };

function useFinOpsWorker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setEstimate = useFinOpsStore((s) => s.setEstimate);
  const setNodeCosts = useFinOpsStore((s) => s.setNodeCosts);
  const addToast = useToastStore((s) => s.addToast);
  const projectIdFromUrl = typeof window !== "undefined"
    ? window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null
    : null;

  const calculate = (monthlyUsers: number) => {
    if (!projectIdFromUrl) {
      addToast({ type: "error", title: "No project", message: "Open a project to estimate costs", duration: 4000 });
      return;
    }
    setLoading(true);
    setError(null);
    const worker = new Worker(new URL("../../workers/finOps.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      if (e.data.type === "error") { setError(e.data.error); setLoading(false); return; }
      const report = e.data.report;
      setEstimate(report);
      const costs: { nodeId: string; label: string; monthlyCost: number }[] = [];
      for (const cat of report.currentEstimate.breakdown) {
        for (const item of cat.items) {
          const match = nodes.find((n) => n.data?.label === item.service);
          if (match) costs.push({ nodeId: match.id, label: item.service, monthlyCost: item.monthlyCost });
        }
      }
      setNodeCosts(costs);
      setLoading(false);
      addToast({ type: "success", title: "Cost estimate ready", message: `${report.currentEstimate.breakdown.length} cost categories — $${Math.round(report.currentEstimate.totalMonthlyCost).toLocaleString()}/mo`, duration: 5000 });
    };
    worker.onerror = () => { setError("Worker calculation failed"); setLoading(false); };
    worker.postMessage({ type: "calculate", projectId: projectIdFromUrl, nodes: nodes.map((n) => ({ id: n.id, nodeType: n.data?.nodeType ?? "", label: n.data?.label ?? "", instances: n.data?.config?.instances ?? 1, region: n.data?.config?.region ?? "us-east-1", maxRPS: n.data?.config?.maxRPS ?? 1000, computeTier: n.data?.config?.computeTier ?? "on_demand" })), edges: edges.map((e) => ({ source: e.source, target: e.target, trafficPercent: e.data?.routing?.trafficPercent ?? 100 })), monthlyUsers });
  };

  return { calculate, loading, error, setError };
}

export default function FinOpsModal({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const [monthlyUsers, setMonthlyUsers] = useState(1000);
  const { calculate, loading, error, setError } = useFinOpsWorker();
  const estimate = useFinOpsStore((s) => s.estimate);
  const hasResults = estimate !== null;

  const handleCalculate = () => {
    setError(null);
    calculate(monthlyUsers);
  };

  return (
    <Box sx={{
      position: embedded ? "static" : ("fixed" as const),
      height: embedded ? "100%" : undefined,
      inset: embedded ? undefined : 0,
      zIndex: embedded ? undefined : 1300,
      bgcolor: embedded ? undefined : "rgba(10,10,11,0.92)",
      backdropFilter: embedded ? undefined : "blur(16px)",
      display: "flex",
    }}>
      {!embedded && (
        <Box
          onClick={onClose}
          sx={{
            position: "absolute", top: 16, right: 16, zIndex: 10,
            width: 36, height: 36, borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#8B8B8F", cursor: "pointer",
            transition: "all 0.15s",
            "&:hover": { bgcolor: "#252528", color: "#EDEDEF" },
            "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
          }}
          tabIndex={0}
          role="button"
          aria-label="Close cost estimation"
        >
          <X size={20} />
        </Box>
      )}

      {/* Left sidebar */}
      <Box sx={{
        width: 200, flexShrink: 0, borderRight: "1px solid #2A2A2E",
        display: "flex", flexDirection: "column", pt: 6, px: 1.5,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <DollarSign size={18} color="#22c55e" />
          <Typography variant="caption" sx={{ color: "#EDEDEF", fontWeight: 600, fontSize: "0.7rem" }}>
            Cost Estimation
          </Typography>
        </Box>

        <Typography variant="caption" sx={{
          color: "#8B8B8F", textTransform: "uppercase", letterSpacing: "0.08em",
          fontWeight: 600, fontSize: "0.5rem", mb: 1,
        }}>
          Monthly Users
        </Typography>
        <ButtonGroup fullWidth size="small" sx={{ mb: 1.5, "& .MuiButton-root": { fontSize: "0.6rem", borderColor: "#2A2A2E !important" } }}>
          {USER_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={monthlyUsers === preset.value ? "contained" : "outlined"}
              onClick={() => setMonthlyUsers(preset.value)}
              sx={{
                bgcolor: monthlyUsers === preset.value ? "#6366F1 !important" : "transparent",
                color: monthlyUsers === preset.value ? "#fff !important" : "#8B8B8F",
                "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              {preset.label}
            </Button>
          ))}
        </ButtonGroup>

        <Button
          variant="contained"
          onClick={handleCalculate}
          disabled={loading}
          sx={{
            fontSize: "0.65rem", fontWeight: 600, py: 0.75,
            bgcolor: "#22C55E", color: "#09090b",
            "&:hover": { bgcolor: "#16A34A" },
            "&:disabled": { bgcolor: "#2A2A2E", color: "#555558" },
            "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
            "&:active": { transform: "scale(0.98)" },
            transition: "all 0.12s",
            textTransform: "none", borderRadius: "6px",
          }}
        >
          {loading ? "Calculating..." : "Calculate"}
        </Button>

        {error && (
          <Box sx={{ mt: 1.5, p: 1, bgcolor: "rgba(239,68,68,0.1)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.55rem" }}>{error}</Typography>
          </Box>
        )}
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          px: 2.5, py: 1.5, borderBottom: "1px solid #2A2A2E", flexShrink: 0,
        }}>
          <Typography variant="caption" sx={{ color: "#555558", fontSize: "0.55rem" }}>
            {hasResults ? `${estimate!.currentEstimate.breakdown.length} cost categories` : "Configure and calculate"}
          </Typography>
          {hasResults && (
            <Box sx={{ px: 0.75, py: 0.25, borderRadius: "999px", bgcolor: "rgba(34,197,54,0.15)" }}>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#22c55e", fontSize: "0.65rem", fontWeight: 600 }}>
                {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}/mo
              </Typography>
            </Box>
          )}
        </Box>

        {/* Content */}
        <motion.div
          key={hasResults ? "results" : "empty"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "16px 24px" }}
        >
          {!hasResults ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 1.5 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={24} color="#22c55e" />
              </Box>
              <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.75rem", fontWeight: 500 }}>Calculate your cloud bill</Typography>
              <Typography variant="caption" sx={{ color: "#555558", fontSize: "0.6rem", textAlign: "center", maxWidth: 320, lineHeight: 1.4 }}>
                Configure your architecture on the canvas, then set monthly users and calculate.
              </Typography>
              <Button variant="contained" onClick={handleCalculate} disabled={loading}
                sx={{ fontSize: "0.65rem", bgcolor: "#22C55E", color: "#09090b", textTransform: "none", borderRadius: "6px", "&:hover": { bgcolor: "#16A34A" }, "&:active": { transform: "scale(0.98)" }, "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 } }}>
                {loading ? "Calculating..." : "Calculate Now"}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
              {/* Total cost hero */}
              <Box sx={{ p: 2, textAlign: "center", bgcolor: "rgba(0,100,0,0.08)", borderRadius: "8px", border: "1px solid rgba(34,197,54,0.2)" }}>
                <Typography variant="caption" sx={{ color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.5, fontSize: "0.55rem", opacity: 0.7 }}>
                  Estimated Monthly Cost
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: "monospace", fontWeight: 700, color: "#22c55e", fontSize: "1.5rem" }}>
                  {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}
                </Typography>
                <Typography variant="caption" sx={{ color: "#22c55e", display: "block", mt: 0.5, fontSize: "0.55rem", opacity: 0.5 }}>
                  for {estimate!.monthlyUsers.toLocaleString()} users
                </Typography>
              </Box>

              {/* Charts grid */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
                <ChartCard title="Scaling Projection">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={estimate!.scalingProjections.map((p: any) => ({ name: p.userTier.replace(/ users.*$/, ""), monthlyCost: Math.round(p.totalMonthlyCost * 100) / 100 }))}>
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                      <Tooltip {...CHART_TOOLTIP as any} formatter={(value: any) => [formatCurrency(Number(value)), "Monthly Cost"]} />
                      <Line type="monotone" dataKey="monthlyCost" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Edge vs Origin Cost">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={(estimate!.currentEstimate as any).breakdown?.flatMap?.((cat: any) => cat.items)?.filter?.((i: any) => i.monthlyCost > 0)?.slice?.(0, 6) ?? []}
                        cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="monthlyCost" nameKey="service"
                        startAngle={90} endAngle={-270}>
                        {Array.from({ length: 6 }).map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="none" />)}
                      </Pie>
                      <Tooltip {...CHART_TOOLTIP as any} formatter={(value: any) => [formatCurrency(Number(value)), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </Box>

              {/* Breakdown */}
              <Box>
                <Typography variant="caption" sx={{ color: "#8B8B8F", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.75, fontSize: "0.55rem" }}>
                  Breakdown by Category
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {estimate!.currentEstimate.breakdown.map((cat: any, i: number) => (
                    <CategoryRow key={i} cat={cat} />
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </motion.div>
      </Box>
    </Box>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.5, bgcolor: "#1E1E20", borderRadius: "8px", border: "1px solid #2A2A2E" }}>
      <Typography variant="caption" sx={{ color: "#8B8B8F", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.55rem" }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function CategoryRow({ cat }: { cat: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box sx={{ bgcolor: "#1E1E20", borderRadius: "6px", border: "1px solid #2A2A2E", overflow: "hidden" }}>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          px: 1.5, py: 1, cursor: "pointer",
          transition: "background 0.12s",
          "&:hover": { bgcolor: "#252528" },
          "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
        }}
        tabIndex={0}
        role="button"
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ color: "#EDEDEF", fontWeight: 500, fontSize: "0.6rem" }}>{cat.category}</Typography>
          <Typography variant="caption" sx={{ color: "#555558", fontSize: "0.55rem" }}>{cat.items.length} item(s)</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 500, color: "#22c55e", fontSize: "0.65rem" }}>
            {formatCurrency(cat.subtotal)}
          </Typography>
          {expanded ? <ChevronUp size={14} color="#555558" /> : <ChevronDown size={14} color="#555558" />}
        </Box>
      </Box>
      {expanded && (
        <Box sx={{ borderTop: "1px solid #2A2A2E" }}>
          {cat.items.map((item: any, i: number) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.75 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: "#8B8B8F", fontSize: "0.55rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.service}
                </Typography>
                <Typography variant="caption" sx={{ color: "#555558", fontSize: "0.5rem" }}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#EDEDEF", ml: 1, flexShrink: 0, fontSize: "0.6rem" }}>
                {formatCurrency(item.monthlyCost)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
