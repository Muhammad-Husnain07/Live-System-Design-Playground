import { useState, useCallback, useMemo, memo } from "react";
import { ChevronUp, ChevronDown, DollarSign } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { useFinOpsStore, type CostReport, type CostCategory } from "../../store/finopsStore";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../ui/EmptyState";
import api from "../../utils/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const USER_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "10K", value: 10_000 },
  { label: "100K", value: 100_000 },
  { label: "1M", value: 1_000_000 },
];

const EFFORT_COLORS: Record<string, string> = {
  low: "text-green-400 bg-green-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  high: "text-red-400 bg-red-500/10",
};

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function CategoryRow({ cat }: { cat: CostCategory }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-surface-900 rounded border border-surface-800">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-surface-200">{cat.category}</span>
          <span className="text-[9px] text-surface-500">{cat.items.length} item(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-medium text-green-400 tabular-nums">
            {formatCurrency(cat.subtotal)}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-surface-600" /> : <ChevronDown className="h-4 w-4 text-surface-600" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-surface-800 divide-y divide-surface-800">
          {cat.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-surface-300 truncate">{item.service}</p>
                <p className="text-[8px] text-surface-600">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
              </div>
              <span className="text-[10px] font-mono text-surface-200 tabular-nums ml-2 shrink-0">
                {formatCurrency(item.monthlyCost)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CHART_GRID = { strokeDasharray: "3 3", stroke: "#27272a" };
const CHART_TICK = { fontSize: 9, fill: "#71717a" };
const CHART_TOOLTIP = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 };
const CHART_TOOLTIP_LABEL = { color: "#e4e4e7" };
const CHART_DOT = { fill: "#22c55e", r: 3 };

const ChartCard = memo(function ChartCard({ projections }: { projections: CostReport["scalingProjections"] }) {
  const chartData = useMemo(() => projections.map((p) => ({
    name: p.userTier.replace(/ users.*$/, ""),
    monthlyCost: Math.round(p.totalMonthlyCost * 100) / 100,
  })), [projections]);

  const tickFormatter = useCallback((v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`, []);
  const tooltipFormatter = useCallback((value: number) => [formatCurrency(Number(value)), "Monthly Cost"], []);

  return (
    <div className="bg-surface-900 rounded border border-surface-800 p-3">
      <p className="text-[9px] uppercase tracking-wider text-surface-500 font-medium mb-2">
        Scaling Projection
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
          <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={CHART_TOOLTIP_LABEL} formatter={tooltipFormatter as any} />
          <Line type="monotone" dataKey="monthlyCost" stroke="#22c55e" strokeWidth={2} dot={CHART_DOT} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function RecommCard({ rec, index }: { rec: CostReport["recommendations"][0]; index: number }) {
  return (
    <div className="bg-surface-900 rounded border border-surface-800 p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-surface-500 shrink-0">#{index + 1}</span>
          <p className="text-[10px] font-medium text-surface-200 truncate">{rec.title}</p>
        </div>
        {rec.effort && (
          <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 font-medium ${EFFORT_COLORS[rec.effort] ?? "text-surface-500 bg-surface-800"}`}>
            {rec.effort}
          </span>
        )}
      </div>
      <p className="text-[9px] text-surface-400 leading-relaxed">{rec.description}</p>
      {rec.potentialSavings > 0 && (
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-green-400 font-medium">
            Save {formatCurrency(rec.potentialSavings)}/mo
          </span>
          <span className="text-surface-600">
            {formatCurrency(rec.annualSavings)}/yr
          </span>
        </div>
      )}
    </div>
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
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-green-400" />
        <span className="text-xs font-semibold text-surface-100">Cost Estimation</span>
        {hasResults && (
          <span className="ml-auto text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-mono">
            {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}/mo
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        <div className="px-3 py-2 space-y-3">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-surface-500 font-medium mb-1.5">
              Monthly Users
            </p>
            <div className="flex gap-1">
              {USER_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setMonthlyUsers(preset.value)}
                  className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-colors ${
                    monthlyUsers === preset.value
                      ? "bg-green-500/30 text-green-300 border border-green-500/40"
                      : "bg-surface-800 text-surface-400 hover:bg-surface-700 border border-transparent"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                Calculating...
              </>
            ) : (
              "Calculate"
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-[10px] text-red-400">{error}</p>
            </div>
          )}

          {!hasResults && !error && (
            <EmptyState
              icon="$"
              title="No estimate yet"
              description="Configure your architecture on the canvas, then estimate monthly costs."
            />
          )}

          {hasResults && (
            <div className="space-y-3 pb-3">
              <div className="bg-green-950/30 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-[9px] uppercase tracking-wider text-green-500/70 font-medium mb-1">
                  Estimated Monthly Cost
                </p>
                <p className="text-2xl font-bold font-mono text-green-400 tabular-nums">
                  {formatCurrency(estimate!.currentEstimate.totalMonthlyCost)}
                </p>
                <p className="text-[9px] text-green-500/50 mt-1">
                  for {estimate!.monthlyUsers.toLocaleString()} users
                </p>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wider text-surface-500 font-medium mb-1.5">
                  Breakdown by Category
                </p>
                <div className="space-y-1">
                  {estimate!.currentEstimate.breakdown.map((cat, i) => (
                    <CategoryRow key={i} cat={cat} />
                  ))}
                </div>
              </div>

              {estimate!.scalingProjections.length > 0 && (
                <ChartCard projections={estimate!.scalingProjections} />
              )}

              {estimate!.recommendations.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-surface-500 font-medium mb-1.5">
                    Recommendations ({estimate!.recommendations.length})
                  </p>
                  <div className="space-y-1.5">
                    {estimate!.recommendations.map((rec, i) => (
                      <RecommCard key={i} rec={rec} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
