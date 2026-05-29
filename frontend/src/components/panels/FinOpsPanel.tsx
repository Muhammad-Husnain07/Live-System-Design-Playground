import { useState, useCallback, useMemo, memo } from "react";
import { ChevronUp, ChevronDown, DollarSign } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { useFinOpsStore, type CostReport, type CostCategory } from "../../store/finopsStore";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../ui/EmptyState";
import api from "../../utils/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import ButtonGroup from "@mui/material/ButtonGroup";
import Button from "@mui/material/Button";

const USER_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "10K", value: 10_000 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
];

const EFFORT_COLORS: Record<string, { color: string; bgClass: string }> = {
  low: { color: "#22c55e", bgClass: "bg-green-500/10" },
  medium: { color: "#facc15", bgClass: "bg-yellow-500/10" },
  high: { color: "#ef4444", bgClass: "bg-red-500/10" },
};

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#27272a" };
const CHART_TICK = { fontSize: 9, fill: "#71717a" };
const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 };
const CHART_TOOLTIP_LABEL = { color: "#e4e4e7" };
const CHART_DOT = { fill: "#22c55e", r: 3 };

const DONUT_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#eab308"];

function CategoryRow({ cat }: { cat: CostCategory }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Paper variant="outlined" sx={{ bgcolor: "action.hover" }}>
      <Button
        onClick={() => setExpanded((v) => !v)}
        fullWidth
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1, textTransform: "none", borderRadius: 0 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.65rem" }}>{cat.category}</Typography>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>{cat.items.length} item(s)</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 500, color: "success.main", fontSize: "0.7rem" }}>
            {formatCurrency(cat.subtotal)}
          </Typography>
          {expanded ? <ChevronUp size={16} style={{ color: "#52525b" }} /> : <ChevronDown size={16} style={{ color: "#52525b" }} />}
        </Box>
      </Button>
      {expanded && (
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          {cat.items.map((item, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.75 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.service}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.55rem" }}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", ml: 1, flexShrink: 0, fontSize: "0.65rem" }}>
                {formatCurrency(item.monthlyCost)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

const EgressDonutChart = memo(function EgressDonutChart({ estimate }: { estimate: CostReport["currentEstimate"] }) {
  const chartData = useMemo(() => {
    const otherTotal = estimate.totalMonthlyCost - (estimate.dataEgressTotal ?? 0);
    return [
      { name: "Data Egress", value: Math.round((estimate.dataEgressTotal ?? 0) * 100) / 100 },
      { name: "Other Costs", value: Math.round(Math.max(otherTotal, 0) * 100) / 100 },
    ];
  }, [estimate]);

  if ((estimate.dataEgressTotal ?? 0) <= 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Data Egress
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={52}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={DONUT_COLORS[idx]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
              formatter={(value: number) => [formatCurrency(value), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {chartData.map((d, i) => (
            <Box key={d.name} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: DONUT_COLORS[i] }} />
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>{d.name}</Typography>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", ml: "auto", fontSize: "0.65rem" }}>{formatCurrency(d.value)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
});

const ChartCard = memo(function ChartCard({ projections }: { projections: CostReport["scalingProjections"] }) {
  const chartData = useMemo(() => projections.map((p) => ({
    name: p.userTier.replace(/ users.*$/, ""),
    monthlyCost: Math.round(p.totalMonthlyCost * 100) / 100,
  })), [projections]);

  const tickFormatter = useCallback((v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`, []);
  const tooltipFormatter = useCallback((value: number) => [formatCurrency(Number(value)), "Monthly Cost"], []);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Scaling Projection
      </Typography>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
          <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={CHART_TOOLTIP_LABEL} formatter={tooltipFormatter as any} />
          <Line type="monotone" dataKey="monthlyCost" stroke="#22c55e" strokeWidth={2} dot={CHART_DOT} />
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
});

function RecommCard({ rec, index }: { rec: CostReport["recommendations"][0]; index: number }) {
  const effortColor = EFFORT_COLORS[rec.effort];
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0, fontSize: "0.65rem" }}>#{index + 1}</Typography>
          <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.65rem" }}>
            {rec.title}
          </Typography>
        </Box>
        {rec.effort && (
          <Box sx={{ px: 0.5, py: 0.25, borderRadius: "4px", flexShrink: 0, bgcolor: effortColor?.bgClass ?? "action.hover" }}>
            <Typography variant="caption" sx={{ fontSize: "0.55rem", fontWeight: 500, color: effortColor?.color ?? "text.disabled" }}>
              {rec.effort}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", lineHeight: 1.4 }}>{rec.description}</Typography>
      {rec.potentialSavings > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 500, fontSize: "0.6rem" }}>
            Save {formatCurrency(rec.potentialSavings)}/mo
          </Typography>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>
            {formatCurrency(rec.annualSavings)}/yr
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default function FinOpsPanel() {
  const [monthlyUsers, setMonthlyUsers] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const estimate = useFinOpsStore((s) => s.estimate);
  const setEstimate = useFinOpsStore((s) => s.setEstimate);
  const setNodeCosts = useFinOpsStore((s) => s.setNodeCosts);
  const addToast = useToastStore((s) => s.addToast);

  const projectIdFromUrl = typeof window !== "undefined"
    ? window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null
    : null;

  const handleCalculate = useCallback(async () => {
    if (!projectIdFromUrl) {
      addToast({ type: "error", title: "No project", message: "Open a project to estimate costs", duration: 4000 });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.post("/finops/estimate", {
        projectId: projectIdFromUrl,
        monthlyUsers,
      });
      const report = resp.data as CostReport;
      setEstimate(report);

      const costs: { nodeId: string; label: string; monthlyCost: number }[] = [];
      for (const cat of report.currentEstimate.breakdown) {
        for (const item of cat.items) {
          const match = nodes.find((n) => n.data?.label === item.service);
          if (match) {
            costs.push({ nodeId: match.id, label: item.service, monthlyCost: item.monthlyCost });
          }
        }
      }
      setNodeCosts(costs);

      addToast({
        type: "success",
        title: "Cost estimate ready",
        message: `${report.currentEstimate.breakdown.length} cost categories — $${Math.round(report.currentEstimate.totalMonthlyCost).toLocaleString()}/mo`,
        duration: 5000,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Estimation failed";
      setError(msg);
      addToast({ type: "error", title: "Estimation failed", message: msg, duration: 5000 });
    } finally {
      setLoading(false);
    }
  }, [projectIdFromUrl, monthlyUsers, nodes, setEstimate, setNodeCosts, addToast]);

  const hasResults = estimate !== null;

  return (
    <Box className="w-80 shrink-0 bg-surface-950 border-l border-surface-800" sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <DollarSign size={16} style={{ color: "#22c55e" }} />
        <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 600, fontSize: "0.75rem" }}>Cost Estimation</Typography>
        {hasResults && (
          <Box sx={{ ml: "auto", px: 0.75, py: 0.25, borderRadius: "999px", bgcolor: "rgba(34,197,94,0.15)" }}>
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "success.main", fontSize: "0.6rem" }}>
              {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}/mo
            </Typography>
          </Box>
        )}
      </Box>

      <Box className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        <Box sx={{ px: 1.5, py: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box>
            <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.75, fontSize: "0.6rem" }}>
              Monthly Users
            </Typography>
            <ButtonGroup fullWidth size="small" sx={{ "& .MuiButton-root": { fontSize: "0.65rem" } }}>
              {USER_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={monthlyUsers === preset.value ? "contained" : "outlined"}
                  onClick={() => setMonthlyUsers(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          <Button
            variant="contained"
            color="success"
            onClick={handleCalculate}
            disabled={loading}
            sx={{ fontSize: "0.7rem" }}
          >
            {loading ? "Calculating..." : "Calculate"}
          </Button>

          {error && (
            <Paper variant="outlined" sx={{ p: 1, bgcolor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }}>
              <Typography variant="caption" sx={{ color: "error.main", fontSize: "0.65rem" }}>{error}</Typography>
            </Paper>
          )}

          {!hasResults && !error && (
            <EmptyState
              icon="$"
              title="No estimate yet"
              description="Configure your architecture on the canvas, then estimate monthly costs."
            />
          )}

          {hasResults && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 1.5 }}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", bgcolor: "rgba(0,100,0,0.1)", borderColor: "rgba(34,197,94,0.3)" }}>
                <Typography variant="caption" sx={{ color: "success.main", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.5, fontSize: "0.6rem", opacity: 0.7 }}>
                  Estimated Monthly Cost
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: "monospace", fontWeight: 700, color: "success.main", fontSize: "1.5rem" }}>
                  {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}
                </Typography>
                <Typography variant="caption" sx={{ color: "success.main", display: "block", mt: 0.5, fontSize: "0.6rem", opacity: 0.5 }}>
                  for {estimate!.monthlyUsers.toLocaleString()} users
                </Typography>
              </Paper>

              <EgressDonutChart estimate={estimate!.currentEstimate} />

              <Box>
                <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.75, fontSize: "0.6rem" }}>
                  Breakdown by Category
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {estimate!.currentEstimate.breakdown.map((cat, i) => (
                    <CategoryRow key={i} cat={cat} />
                  ))}
                </Box>
              </Box>

              {estimate!.scalingProjections.length > 0 && (
                <ChartCard projections={estimate!.scalingProjections} />
              )}

              {estimate!.recommendations.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 0.75, fontSize: "0.6rem" }}>
                    Recommendations ({estimate!.recommendations.length})
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {estimate!.recommendations.map((rec, i) => (
                      <RecommCard key={i} rec={rec} index={i} />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
