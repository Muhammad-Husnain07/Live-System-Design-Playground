import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { NodeType, NodeConfig, NodeMetrics, EdgeRoutingConfig } from "../../types/canvas";

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "sa-east-1"];

const PROTOCOLS = ["HTTP", "gRPC", "TCP", "WebSocket", "AMQP"] as const;

const STRATEGIES = ["rolling", "blue_green", "canary"] as const;

export default function NodeConfigPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateEdge = useCanvasStore((s) => s.updateEdge);
  const isSimRunning = useCanvasStore((s) => s.isSimulationRunning);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  const onUpdateNode = useCallback(
    (patch: Partial<NodeConfig>) => {
      if (selectedNode) updateNodeConfig(selectedNode.id, patch);
    },
    [selectedNode, updateNodeConfig],
  );

  const onUpdateLabel = useCallback(
    (label: string) => {
      if (selectedNode) updateNodeData(selectedNode.id, { label });
    },
    [selectedNode, updateNodeData],
  );

  const onUpdateEdgeData = useCallback(
    (patch: Record<string, any>) => {
      if (selectedEdge) updateEdge(selectedEdge.id, patch);
    },
    [selectedEdge, updateEdge],
  );

  return (
    <motion.aside
      className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 overflow-y-auto overflow-x-hidden"
    >
      <AnimatePresence mode="wait">
        {selectedNode ? (
          <NodeConfigContent key="node" node={selectedNode} onUpdate={onUpdateNode} onUpdateLabel={onUpdateLabel} simRunning={isSimRunning} nodes={nodes} />
        ) : selectedEdge ? (
          <EdgeConfigContent key="edge" edge={selectedEdge} onUpdate={onUpdateEdgeData} nodes={nodes} />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 text-center text-surface-500 text-xs mt-8"
          >
            Select a node or edge to configure
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-surface-800 last:border-b-0">
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-3 pb-3 space-y-2.5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable field controls                                            */
/* ------------------------------------------------------------------ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-surface-500 shrink-0">{label}</span>
      <div className="w-36">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[10px] text-surface-400 group-hover:text-surface-300 transition-colors">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-green-500"
      />
    </label>
  );
}

function SliderField({ label, value, min = 0, max = 100, step = 1, onChange, suffix = "" }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-surface-500">{label}</span>
        <span className="text-[10px] text-surface-300 font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 appearance-none bg-surface-700 rounded-full cursor-pointer accent-green-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500"
      />
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: readonly string[] | string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface-800 text-surface-200 text-[10px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500 transition-colors"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function NumInput({ value, min, max, step, onChange }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-surface-800 text-surface-200 text-[10px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500 transition-colors"
    />
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-surface-800 text-surface-200 text-[10px] px-2 py-1.5 rounded border border-surface-700 placeholder-surface-500 focus:outline-none focus:border-blue-500 transition-colors"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Node config (6 sections)                                           */
/* ------------------------------------------------------------------ */
function NodeConfigContent({ node, onUpdate, simRunning, nodes, onUpdateLabel }: {
  node: any;
  onUpdate: (patch: Partial<NodeConfig>) => void;
  simRunning: boolean;
  nodes: any[];
  onUpdateLabel?: (label: string) => void;
}) {
  const cfg: NodeConfig | undefined = node.data?.config;
  const nt = node.data?.nodeType as NodeType | undefined;
  const meta = nt ? NODE_REGISTRY[nt] : null;
  const metrics: NodeMetrics | undefined = node.data?.metrics;
  const label = node.data?.label as string | undefined;

  if (!cfg) return <div className="p-4 text-red-400 text-xs">Missing config</div>;

  return (
    <motion.div
      key="node"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.15 }}
    >
      {/* Section 1 — Identity */}
      <Section title="Identity">
        <Field label="Label">
          <TextInput value={label ?? ""} onChange={(v) => onUpdateLabel?.(v)} placeholder="Node label" />
        </Field>
        {meta && (
          <div className="flex items-center gap-2">
            <span className="text-sm">{meta.icon}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
              {meta.label}
            </span>
          </div>
        )}
        <Field label="Region">
          <Select value={cfg.region} options={REGIONS} onChange={(v) => onUpdate({ region: v })} />
        </Field>
      </Section>

      {/* Section 2 — Capacity */}
      <Section title="Capacity">
        <Field label="Instances">
          <NumInput value={cfg.instances} min={1} max={100} onChange={(v) => onUpdate({ instances: v })} />
        </Field>
        <Field label="Max RPS">
          <NumInput value={cfg.maxRPS} min={0} onChange={(v) => onUpdate({ maxRPS: v })} />
        </Field>
        <Field label="Avg Latency">
          <NumInput value={cfg.latencyMs} min={0} onChange={(v) => onUpdate({ latencyMs: v })} />
        </Field>
        {cfg.latencyMs > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex-1 h-1 bg-surface-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((cfg.latencyMs / 500) * 100, 100)}%` }} />
            </div>
            <span className="text-[8px] text-surface-600 w-6 text-right">500ms</span>
          </div>
        )}
      </Section>

      {/* Section 3 — Reliability */}
      <Section title="Reliability">
        <SliderField
          label="Error Rate"
          value={Math.round(cfg.errorRate * 100)}
          max={100}
          onChange={(v) => onUpdate({ errorRate: v / 100 })}
          suffix="%"
        />
        <Toggle label="Failed" checked={cfg.isFailed} onChange={(v) => onUpdate({ isFailed: v })} />
        <Toggle label="Bottleneck" checked={cfg.isBottleneck} onChange={(v) => onUpdate({ isBottleneck: v })} />
      </Section>

      {/* Section 4 — Deployment Strategy */}
      <Section title="Deployment Strategy">
        <Field label="Strategy">
          <Select value={cfg.deployment.strategy} options={STRATEGIES} onChange={(v) => onUpdate({ deployment: { ...cfg.deployment, strategy: v as "rolling" | "blue_green" | "canary" } })} />
        </Field>
        {cfg.deployment.strategy === "canary" && (
          <>
            <SliderField
              label="Canary Traffic"
              value={cfg.deployment.canaryPercent}
              onChange={(v) => onUpdate({ deployment: { ...cfg.deployment, canaryPercent: v } })}
              suffix="%"
            />
          </>
        )}
        {cfg.deployment.strategy !== "rolling" && (
          <Field label="Canary Version">
            <TextInput value={cfg.deployment.canaryVersion} onChange={(v) => onUpdate({ deployment: { ...cfg.deployment, canaryVersion: v } })} placeholder="e.g. v2" />
          </Field>
        )}
        <Toggle
          label="Activate Canary"
          checked={cfg.deployment.isCanaryActive}
          onChange={(v) => onUpdate({ deployment: { ...cfg.deployment, isCanaryActive: v } })}
        />
      </Section>

      {/* Section 5 — Security */}
      <Section title="Security">
        <Toggle label="Public Facing" checked={cfg.security.isPublicFacing} onChange={(v) => onUpdate({ security: { ...cfg.security, isPublicFacing: v } })} />
        <Toggle label="Requires TLS" checked={cfg.security.requiresTLS} onChange={(v) => onUpdate({ security: { ...cfg.security, requiresTLS: v } })} />
        <Field label="VPC ID">
          <TextInput value={cfg.security.vpcId} onChange={(v) => onUpdate({ security: { ...cfg.security, vpcId: v } })} placeholder="vpc-xxxx" />
        </Field>
        <div>
          <div className="text-[10px] text-surface-500 mb-1">Allowed Inbound</div>
          <div className="max-h-28 overflow-y-auto space-y-1 border border-surface-800 rounded p-1.5">
            {nodes.filter((n) => n.id !== node.id).length === 0 ? (
              <div className="text-[9px] text-surface-600 text-center py-1">No other nodes available</div>
            ) : (
              nodes
                .filter((n) => n.id !== node.id)
                .map((n) => {
                  const checked = cfg.security.allowedInbound?.includes(n.id) ?? false;
                  const nm = NODE_REGISTRY[n.data?.nodeType as NodeType];
                  return (
                    <label key={n.id} className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? (cfg.security.allowedInbound ?? []).filter((id: string) => id !== n.id)
                            : [...(cfg.security.allowedInbound ?? []), n.id];
                          onUpdate({ security: { ...cfg.security, allowedInbound: next } });
                        }}
                        className="accent-green-500"
                      />
                      <span className="text-[10px] text-surface-400 group-hover:text-surface-300 truncate">
                        {nm?.icon ?? ""} {n.data?.label ?? n.id}
                      </span>
                    </label>
                  );
                })
            )}
          </div>
        </div>
      </Section>

      {/* Section 6 — Live Metrics */}
      {simRunning && (
        <Section title="Live Metrics">
          {metrics ? (
            <>
              <Field label="Current RPS"><MetricValue>{metrics.currentRPS.toLocaleString()}</MetricValue></Field>
              <Field label="CPU"><MetricValue>{Math.round(metrics.cpuPercent)}%</MetricValue></Field>
              <Field label="Memory"><MetricValue>{Math.round(metrics.memoryPercent)}%</MetricValue></Field>
              <Field label="Queue Depth"><MetricValue>{metrics.queueDepth}</MetricValue></Field>
              <Field label="P99 Latency"><MetricValue>{metrics.p99LatencyMs}ms</MetricValue></Field>
              <Field label="Error Count"><MetricValue>{metrics.errorCount}</MetricValue></Field>
              {cfg.deployment.isCanaryActive && (
                <Field label="Canary RPS"><MetricValue>{(metrics as any).canaryRPS?.toLocaleString() ?? 0}</MetricValue></Field>
              )}
            </>
          ) : (
            <div className="text-[9px] text-surface-600 text-center py-2">No metrics available</div>
          )}
        </Section>
      )}
    </motion.div>
  );
}

function MetricValue({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-surface-200 font-mono">{children}</span>;
}

/* ------------------------------------------------------------------ */
/*  Edge config                                                        */
/* ------------------------------------------------------------------ */
function EdgeConfigContent({ edge, onUpdate, nodes }: {
  edge: any;
  onUpdate: (patch: Record<string, any>) => void;
  nodes: any[];
}) {
  const routing: EdgeRoutingConfig | undefined = edge.data?.routing;

  if (!routing) return <div className="p-4 text-red-400 text-xs">Missing routing config</div>;

  const srcNode = nodes.find((n) => n.id === edge.source);
  const tgtNode = nodes.find((n) => n.id === edge.target);
  const srcLabel = srcNode?.data?.label ?? edge.source;
  const tgtLabel = tgtNode?.data?.label ?? edge.target;

  return (
    <motion.div
      key="edge"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.15 }}
    >
      {/* Edge header */}
      <div className="px-3 pt-3 pb-2 border-b border-surface-800">
        <div className="text-xs font-medium text-surface-200">Edge Connection</div>
        <div className="text-[10px] text-surface-500 mt-1">
          {srcLabel} → {tgtLabel}
        </div>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        <Field label="Protocol">
          <Select value={routing.protocol} options={PROTOCOLS} onChange={(v) => onUpdate({ routing: { ...routing, protocol: v } })} />
        </Field>

        <Toggle
          label="Synchronous"
          checked={routing.isSync}
          onChange={(v) => onUpdate({ routing: { ...routing, isSync: v } })}
        />

        <Toggle
          label="Requires TLS"
          checked={routing.requiresTLS}
          onChange={(v) => onUpdate({ routing: { ...routing, requiresTLS: v } })}
        />

        <SliderField
          label="Traffic %"
          value={routing.trafficPercent}
          onChange={(v) => onUpdate({ routing: { ...routing, trafficPercent: v } })}
          suffix="%"
        />

        {/* Read-only stats */}
        <div className="pt-2 border-t border-surface-800 space-y-1.5">
          <div className="text-[9px] text-surface-600 font-medium uppercase tracking-wider">Stats</div>
          <Field label="Throughput"><span className="text-[10px] text-surface-300 font-mono">{edge.data?.throughputRPS ?? 0} RPS</span></Field>
          <Field label="Latency"><span className="text-[10px] text-surface-300 font-mono">{edge.data?.latencyMs ?? 0}ms</span></Field>
          <Field label="Animated">
            <input
              type="checkbox"
              checked={edge.data?.isAnimated ?? false}
              onChange={(e) => onUpdate({ isAnimated: e.target.checked })}
              className="accent-green-500"
            />
          </Field>
          <Field label="Saturated">
            <input
              type="checkbox"
              checked={edge.data?.isSaturated ?? false}
              onChange={(e) => onUpdate({ isSaturated: e.target.checked })}
              className="accent-orange-500"
            />
          </Field>
          <Field label="Secure">
            <input
              type="checkbox"
              checked={edge.data?.isSecure ?? true}
              onChange={(e) => onUpdate({ isSecure: e.target.checked })}
              className="accent-green-500"
            />
          </Field>
        </div>
      </div>
    </motion.div>
  );
}
