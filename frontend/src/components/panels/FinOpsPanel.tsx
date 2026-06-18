import { useState, useCallback, useMemo, memo, useRef } from "react";
import { ChevronUp, ChevronDown, DollarSign } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { useFinOpsStore, type CostReport, type CostCategory } from "../../store/finopsStore";
import { useToastStore } from "../../store/toastStore";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Paper, Typography, Box, ButtonGroup, Button, CircularProgress } from "@mui/material";

const USER_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "10K", value: 10_000 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
];

const EFFORT_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#facc15",
  high: "#ef4444",
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
              formatter={(value: any) => { const v = typeof value === "number" ? value : Number(value ?? 0); return [formatCurrency(v), ""]; }}
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

const ProviderBreakdownDonut = memo(function ProviderBreakdownDonut({ estimate, nodes }: { estimate: CostReport["currentEstimate"]; nodes: any[] }) {
  const chartData = useMemo(() => {
    const providerMap = new Map<string, number>();
    for (const node of nodes) {
      const provider = node.data?.config?.cloudProvider ?? "aws";
      const label = node.data?.label ?? "";
      for (const cat of estimate.breakdown) {
        for (const item of cat.items) {
          if (item.service === label) {
            providerMap.set(provider, (providerMap.get(provider) || 0) + item.monthlyCost);
          }
        }
      }
    }
    return Array.from(providerMap.entries())
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: k.toUpperCase(), value: Math.round(v * 100) / 100 }));
  }, [estimate, nodes]);

  if (chartData.length <= 1) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Provider Breakdown
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270}>
              {chartData.map((_, idx) => (<Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} stroke="none" />))}
            </Pie>
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
              formatter={(value: any) => { const v = typeof value === "number" ? value : Number(value ?? 0); return [formatCurrency(v), ""]; }} />
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {chartData.map((d, i) => (
            <Box key={d.name} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>{d.name}</Typography>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", ml: "auto", fontSize: "0.65rem" }}>{formatCurrency(d.value)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
});

const TokenCostCard = memo(function TokenCostCard({ nodes }: { nodes: any[] }) {
  const { inputCost, outputCost } = useMemo(() => {
    let inp = 0;
    let out = 0;
    for (const node of nodes) {
      if (node.data?.nodeType !== "LLMNode") continue;
      inp += ((node.data?.config?.promptTokenCount ?? 0) / 1000) * 0.03;
      out += ((node.data?.config?.completionTokenCount ?? 0) / 1000) * 0.06;
    }
    return { inputCost: Math.round(inp * 100) / 100, outputCost: Math.round(out * 100) / 100 };
  }, [nodes]);

  const total = inputCost + outputCost;
  if (total <= 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.2)" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Token Cost
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>Input ({formatCurrency(0.03)}/1K tokens)</Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", fontSize: "0.65rem" }}>{formatCurrency(inputCost)}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>Output ({formatCurrency(0.06)}/1K tokens)</Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", fontSize: "0.65rem" }}>{formatCurrency(outputCost)}</Typography>
        </Box>
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 0.5, display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, fontSize: "0.6rem" }}>Total</Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 600, fontSize: "0.65rem" }}>{formatCurrency(total)}</Typography>
        </Box>
      </Box>
    </Paper>
  );
});

function NodeCostTable({ nodes, estimate }: { nodes: any[]; estimate: CostReport["currentEstimate"] }) {
  const selectNode = useCanvasStore((s) => s.selectNode);

  const tableData = useMemo(() => {
    const costMap = new Map<string, number>();
    for (const cat of estimate.breakdown) {
      for (const item of cat.items) {
        for (const node of nodes) {
          if (node.data?.label === item.service && item.monthlyCost > 0) {
            costMap.set(node.id, (costMap.get(node.id) || 0) + item.monthlyCost);
          }
        }
      }
    }
    return Array.from(costMap.entries())
      .map(([nodeId, cost]) => ({ nodeId, label: nodes.find((n) => n.id === nodeId)?.data?.label ?? nodeId, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost);
  }, [estimate, nodes]);

  if (tableData.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Node Cost ({tableData.length})
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {tableData.map((row) => (
          <Button
            key={row.nodeId}
            onClick={() => selectNode(row.nodeId)}
            fullWidth
            sx={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              px: 1, py: 0.75, textTransform: "none", borderRadius: "6px",
              bgcolor: "rgba(0,0,0,0.15)", minHeight: 0, lineHeight: "normal",
              "&:hover": { bgcolor: "rgba(59,130,246,0.15)" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, bgcolor: "success.main" }} />
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.label}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", fontWeight: 500, fontSize: "0.65rem", flexShrink: 0 }}>
              {formatCurrency(row.cost)}
            </Typography>
          </Button>
        ))}
      </Box>
    </Paper>
  );
}

const EdgeVsOriginChart = memo(function EdgeVsOriginChart({ estimate, nodes }: { estimate: CostReport["currentEstimate"]; nodes: any[] }) {
  const chartData = useMemo(() => {
    const edgeTypes = new Set(["EdgeCompute", "CDN"]);
    const originTypes = new Set(["WebServer", "AppServer", "Microservice", "PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch", "GPUCluster", "BatchProcessor", "WorkerService"]);
    let edgeCost = 0;
    let originCost = 0;
    for (const node of nodes) {
      const nt = node.data?.nodeType as string;
      const label = node.data?.label ?? "";
      for (const cat of estimate.breakdown) {
        for (const item of cat.items) {
          if (item.service !== label) continue;
          if (edgeTypes.has(nt)) edgeCost += item.monthlyCost;
          if (originTypes.has(nt)) originCost += item.monthlyCost;
        }
      }
    }
    return [
      { name: "Edge", cost: Math.round(edgeCost * 100) / 100, fill: "#06b6d4" },
      { name: "Origin", cost: Math.round(originCost * 100) / 100, fill: "#f97316" },
    ];
  }, [estimate, nodes]);

  if (chartData.every((d) => d.cost <= 0)) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, display: "block", mb: 1, fontSize: "0.6rem" }}>
        Edge vs Origin Cost
      </Typography>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
          <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={CHART_TOOLTIP_LABEL} formatter={(value: any) => { const v = typeof value === "number" ? value : Number(value ?? 0); return [formatCurrency(v), ""]; }} />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (<Cell key={index} fill={entry.fill} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
          <Box sx={{ px: 0.5, py: 0.25, borderRadius: "4px", flexShrink: 0, bgcolor: `${effortColor ?? "action.hover"}15` }}>
            <Typography variant="caption" sx={{ fontSize: "0.55rem", fontWeight: 500, color: effortColor ?? "text.disabled" }}>
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
  const edges = useCanvasStore((s) => s.edges);
  const estimate = useFinOpsStore((s) => s.estimate);
  const setEstimate = useFinOpsStore((s) => s.setEstimate);
  const setNodeCosts = useFinOpsStore((s) => s.setNodeCosts);
  const addToast = useToastStore((s) => s.addToast);

  const projectIdFromUrl = typeof window !== "undefined"
    ? window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null
    : null;

  const workerRef = useRef<Worker | null>(null);

  const handleCalculate = useCallback(() => {
    if (!projectIdFromUrl) {
      addToast({ type: "error", title: "No project", message: "Open a project to estimate costs", duration: 4000 });
      return;
    }
    setLoading(true);
    setError(null);

    if (workerRef.current) workerRef.current.terminate();

    const worker = new Worker(new URL("../../workers/finOps.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === "error") {
        setError(e.data.error);
        addToast({ type: "error", title: "Estimation failed", message: e.data.error, duration: 5000 });
        setLoading(false);
        return;
      }

      const report = e.data.report as CostReport;
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
      setLoading(false);

      addToast({
        type: "success",
        title: "Cost estimate ready",
        message: `${report.currentEstimate.breakdown.length} cost categories — $${Math.round(report.currentEstimate.totalMonthlyCost).toLocaleString()}/mo`,
        duration: 5000,
      });
    };

    worker.onerror = () => {
      setError("Worker calculation failed");
      addToast({ type: "error", title: "Estimation failed", message: "Worker calculation failed", duration: 5000 });
      setLoading(false);
    };

    const workerNodes = nodes.map((n) => ({
      id: n.id,
      nodeType: n.data?.nodeType ?? "",
      label: n.data?.label ?? "",
      instances: n.data?.config?.instances ?? 1,
      region: n.data?.config?.region ?? "us-east-1",
      maxRPS: n.data?.config?.maxRPS ?? 1000,
      computeTier: n.data?.config?.computeTier ?? "on_demand",
      cloudProvider: n.data?.config?.cloudProvider ?? "aws",
    }));

    const workerEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      trafficPercent: e.data?.routing?.trafficPercent ?? 100,
    }));

    worker.postMessage({ type: "calculate", projectId: projectIdFromUrl, nodes: workerNodes, edges: workerEdges, monthlyUsers });
  }, [projectIdFromUrl, monthlyUsers, nodes, edges, setEstimate, setNodeCosts, addToast]);

  const hasResults = estimate !== null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
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

      <Box sx={{ flex: 1, overflowY: "auto", "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { bgcolor: "#3f3f46", borderRadius: "4px" } }}>
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
            startIcon={loading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
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
            <Box sx={{ textAlign: "center", py: 3 }}>
              <Box sx={{ width: 48, height: 48, mx: "auto", mb: 1.5, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={20} style={{ color: "#22c55e" }} />
              </Box>
              <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.7rem", display: "block", mb: 0.5, fontWeight: 500 }}>
                Calculate your cloud bill
              </Typography>
              <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem", display: "block", mb: 2, lineHeight: 1.4, px: 2 }}>
                Configure your architecture on the canvas, then set monthly users and calculate.
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={handleCalculate}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
                sx={{ fontSize: "0.7rem" }}
              >
                {loading ? "Calculating..." : "Calculate Now"}
              </Button>
            </Box>
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

              <ProviderBreakdownDonut estimate={estimate!.currentEstimate} nodes={nodes} />

              <TokenCostCard nodes={nodes} />

              <EdgeVsOriginChart estimate={estimate!.currentEstimate} nodes={nodes} />

              <NodeCostTable nodes={nodes} estimate={estimate!.currentEstimate} />

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
