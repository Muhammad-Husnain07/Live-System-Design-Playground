import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Zap, Clock, AlertTriangle } from "lucide-react";
import { Box, Typography } from "@mui/material";
import {
  XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Area, AreaChart, CartesianGrid,
} from "recharts";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { NodeType } from "../../types/canvas";

interface DeepDiveChartProps {
  nodeId: string | null;
  onClose: () => void;
}

function generateTimeSeries(metrics: any, count = 24) {
  const base = metrics?.currentRPS ?? 500;
  const cpuBase = metrics?.cpuPercent ?? 40;
  const latBase = metrics?.p99LatencyMs ?? 50;
  const errBase = metrics?.errorRate ?? 0.5;
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const t = now - (count - 1 - i) * 5000;
    const noise = () => (Math.random() - 0.5) * 0.3;
    return {
      time: new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      rps: Math.round(base * (1 + noise())),
      cpu: Math.min(100, Math.max(0, Math.round(cpuBase * (1 + noise())))),
      p99: Math.max(0, Math.round(latBase * (1 + noise()))),
      errors: Math.max(0, Math.round(errBase * 10 * (1 + noise()) * 10) / 10),
    };
  });
}

export default memo(function DeepDiveChart({ nodeId, onClose }: DeepDiveChartProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === nodeId);
  const nodeType = node?.data?.nodeType as NodeType | undefined;
  const meta = nodeType ? NODE_REGISTRY[nodeType] : undefined;

  const data = useMemo(() => generateTimeSeries(node?.data?.metrics), [node?.data?.metrics]);

  return (
    <AnimatePresence>
      {nodeId && node && meta && (
        <motion.div
          key="deep-dive"
          className="floating-island"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 110,
            width: 560,
            maxHeight: "80vh",
            background: "rgba(5,5,7,0.92)",
            backdropFilter: "blur(24px) saturate(180%)",
            border: `1px solid ${meta.color}30`,
            borderRadius: "16px",
            boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px ${meta.color}15`,
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Box
              sx={{
                width: 10, height: 10, borderRadius: "50%",
                bgcolor: meta.color,
                boxShadow: `0 0 8px ${meta.color}60`,
                flexShrink: 0,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#EDEDEF", fontFamily: '"Inter", sans-serif' }}>
                {node.data?.label ?? meta.label}
              </Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", fontFamily: '"JetBrains Mono", monospace' }}>
                {nodeType} · {node.data?.config?.region ?? "us-east-1"}
              </Typography>
            </Box>
            <Box
              onClick={onClose}
              sx={{
                cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", p: 0.35,
                borderRadius: "4px", "&:hover": { color: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <X size={14} />
            </Box>
          </Box>

          {/* Charts */}
          <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
            <ChartSection
              title="Throughput (RPS)"
              icon={<Zap size={12} />}
              color="#34D399"
              data={data}
              dataKey="rps"
              unit=" req/s"
              gradientId="rps-grad"
            />
            <ChartSection
              title="P99 Latency"
              icon={<Clock size={12} />}
              color="#60A5FA"
              data={data}
              dataKey="p99"
              unit=" ms"
              gradientId="lat-grad"
            />
            <ChartSection
              title="CPU Utilization"
              icon={<Activity size={12} />}
              color="#F59E0B"
              data={data}
              dataKey="cpu"
              unit="%"
              gradientId="cpu-grad"
            />
            <ChartSection
              title="Error Rate"
              icon={<AlertTriangle size={12} />}
              color="#EF4444"
              data={data}
              dataKey="errors"
              unit=" err/s"
              gradientId="err-grad"
            />
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function ChartSection({
  title, icon, color, data, dataKey, unit, gradientId,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  data: any[];
  dataKey: string;
  unit: string;
  gradientId: string;
}) {
  const lastVal = data[data.length - 1]?.[dataKey] ?? 0;
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ color: "rgba(255,255,255,0.35)", display: "flex" }}>{icon}</Box>
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: '"Inter", sans-serif' }}>
            {title}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color, textShadow: `0 0 12px ${color}40` }}>
          {typeof lastVal === "number" ? lastVal.toLocaleString() : lastVal}{unit}
        </Typography>
      </Box>
      <Box sx={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <RechartTooltip
              contentStyle={{
                background: "rgba(5,5,7,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "6px", fontSize: "0.6rem", color: "#EDEDEF",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
              formatter={(value: any) => [`${Number(value).toLocaleString()}${unit}`, title]}
              labelFormatter={(label: any) => String(label)}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
