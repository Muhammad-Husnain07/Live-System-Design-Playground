import { useCallback, useRef } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { NodeType, NodeConfig, NodeMetrics, EdgeRoutingConfig } from "../../types/canvas";
import { TextField, Slider, FormControl, Select, MenuItem, Switch, FormControlLabel, Chip, Divider, Typography, Box } from "@mui/material";

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "sa-east-1"];
const CLOUD_PROVIDERS = ["aws", "gcp", "azure"];

const PROTOCOLS = ["HTTP", "gRPC", "TCP", "WebSocket", "AMQP", "Replication"] as const;

const STRATEGIES = ["rolling", "blue_green", "canary"] as const;

const sxField = { "& .MuiInputBase-root": { fontSize: "0.7rem" }, "& .MuiInputLabel-root": { fontSize: "0.7rem" } };

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
    <Box sx={{ overflow: "auto", height: "100%" }}>
      <AnimatePresence mode="wait">
        {selectedNode ? (
          <NodeConfigContent key="node" node={selectedNode} onUpdate={onUpdateNode} onUpdateLabel={onUpdateLabel} simRunning={isSimRunning} nodes={nodes} />
        ) : selectedEdge ? (
          <EdgeConfigContent key="edge" edge={selectedEdge} onUpdate={onUpdateEdgeData} nodes={nodes} />
        ) : null}
      </AnimatePresence>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>{children}</Box>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="caption" sx={{ color: "text.disabled", flexShrink: 0, fontSize: "0.65rem" }}>
        {label}
      </Typography>
      <Box sx={{ width: 160, flexShrink: 0 }}>{children}</Box>
    </Box>
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

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUpdate = useCallback((patch: Partial<NodeConfig>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => onUpdateRef.current(patch), 300);
  }, []);

  if (!cfg) return <Box sx={{ p: 2, color: "error.main", fontSize: "0.75rem" }}>Missing config</Box>;

  return (
    <motion.div key="node" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
      {/* Section 1 — Identity */}
      <Section title="Identity">
        <Field label="Label">
          <TextField size="small" value={label ?? ""} onChange={(e) => onUpdateLabel?.(e.target.value)} placeholder="Node label" sx={sxField} />
        </Field>
        {meta && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <meta.icon size={16} />
            <Chip label={meta.label} size="small" sx={{ backgroundColor: `${meta.color}20`, color: meta.color, fontWeight: 500, fontSize: "0.65rem" }} />
          </Box>
        )}
        {cfg.replicationRole && cfg.replicationRole !== "none" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip label={cfg.replicationRole === "primary" ? "Primary" : "Replica"} size="small"
              sx={{ color: cfg.replicationRole === "primary" ? "#22c55e" : "#60a5fa", bgcolor: cfg.replicationRole === "primary" ? "rgba(34,197,94,0.15)" : "rgba(96,165,250,0.15)", fontWeight: 600, fontSize: "0.6rem" }}
            />
            {metrics?.isSplitBrain && (
              <Chip label="Split-Brain" size="small" sx={{ color: "#ef4444", bgcolor: "rgba(239,68,68,0.15)", fontWeight: 600, fontSize: "0.6rem" }} />
            )}
          </Box>
        )}
        <Field label="Region">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={cfg.region} onChange={(e) => onUpdate({ region: e.target.value })}>
              {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </Field>
        <Field label="Cloud Provider">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={cfg.cloudProvider ?? "aws"} onChange={(e) => onUpdate({ cloudProvider: e.target.value })}>
              {CLOUD_PROVIDERS.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
            </Select>
          </FormControl>
        </Field>
      </Section>

      <Divider />

      {/* Section 2 — Capacity */}
      <Section title="Capacity">
        <Field label="Instances">
          <TextField type="number" size="small" value={cfg.instances} slotProps={{ htmlInput: { min: 1, max: 100 } }}
            onChange={(e) => debouncedUpdate({ instances: Math.max(1, Number(e.target.value)) })} sx={sxField} />
        </Field>
        <Field label="Max RPS">
          <TextField type="number" size="small" value={cfg.maxRPS} slotProps={{ htmlInput: { min: 0 } }}
            onChange={(e) => debouncedUpdate({ maxRPS: Math.max(0, Number(e.target.value)) })} sx={sxField} />
        </Field>
        <Field label="Avg Latency">
          <TextField type="number" size="small" value={cfg.latencyMs} slotProps={{ htmlInput: { min: 0 } }}
            onChange={(e) => debouncedUpdate({ latencyMs: Math.max(0, Number(e.target.value)) })} sx={sxField} />
        </Field>
        <Field label="Compute Tier">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={cfg.computeTier ?? "on_demand"} onChange={(e) => onUpdate({ computeTier: e.target.value as "on_demand" | "reserved" | "spot" })}>
              <MenuItem value="on_demand">On-Demand ($30.37)</MenuItem>
              <MenuItem value="reserved">Reserved 1yr ($18.22)</MenuItem>
              <MenuItem value="spot">Spot ($9.11 — 5% interrupt)</MenuItem>
            </Select>
          </FormControl>
        </Field>
      </Section>

      <Divider />

      {/* Section 3 — Reliability */}
      <Section title="Reliability">
        <Box sx={{ px: 1 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Error Rate: {Math.round(cfg.errorRate * 100)}%</Typography>
          <Slider size="small" value={cfg.errorRate * 100} onChange={(_, v) => onUpdate({ errorRate: (v as number) / 100 })} valueLabelDisplay="auto" />
        </Box>
        <FormControlLabel control={<Switch size="small" checked={cfg.isFailed} onChange={(e) => onUpdate({ isFailed: e.target.checked })} />} label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Failed</Typography>} />
        <FormControlLabel control={<Switch size="small" checked={cfg.isBottleneck} onChange={(e) => onUpdate({ isBottleneck: e.target.checked })} />} label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Bottleneck</Typography>} />
      </Section>

      <Divider />

      {/* Section 4 — Replication */}
      {cfg.replicationRole !== undefined && (
        <>
          <Section title="Replication">
            <Field label="Role">
              <FormControl fullWidth size="small" sx={sxField}>
                <Select value={cfg.replicationRole} onChange={(e) => onUpdate({ replicationRole: e.target.value })}>
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="primary">Primary</MenuItem>
                  <MenuItem value="replica">Replica</MenuItem>
                </Select>
              </FormControl>
            </Field>
            {cfg.replicationRole === "replica" && (
              <Field label="Replication Lag">
                <TextField type="number" size="small" value={cfg.replicationLagMs} slotProps={{ htmlInput: { min: 0, max: 5000, step: 10 } }}
                  onChange={(e) => debouncedUpdate({ replicationLagMs: Number(e.target.value) })} sx={sxField} />
              </Field>
            )}
          </Section>
          <Divider />
        </>
      )}

      {/* Section 5 — Auto-Scaling */}
      <Section title="Auto-Scaling">
        <FormControlLabel control={<Switch size="small" checked={cfg.autoScaling?.enabled ?? false} onChange={(e) => onUpdate({ autoScaling: { ...cfg.autoScaling, enabled: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Enabled</Typography>} />
        {(cfg.autoScaling?.enabled || (cfg.autoScaling && !simRunning)) && (
          <>
            <Field label="Min Instances">
              <TextField type="number" size="small" value={cfg.autoScaling?.minInstances ?? 1} slotProps={{ htmlInput: { min: 1, max: 100 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, minInstances: Number(e.target.value) } })} sx={sxField} />
            </Field>
            <Field label="Max Instances">
              <TextField type="number" size="small" value={cfg.autoScaling?.maxInstances ?? 10} slotProps={{ htmlInput: { min: 1, max: 500 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, maxInstances: Number(e.target.value) } })} sx={sxField} />
            </Field>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>CPU Target: {cfg.autoScaling?.targetCPUPercent ?? 70}%</Typography>
              <Slider size="small" value={cfg.autoScaling?.targetCPUPercent ?? 70} onChange={(_, v) => onUpdate({ autoScaling: { ...cfg.autoScaling, targetCPUPercent: v as number } })} valueLabelDisplay="auto" />
            </Box>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Memory Target: {cfg.autoScaling?.targetMemPercent ?? 80}%</Typography>
              <Slider size="small" value={cfg.autoScaling?.targetMemPercent ?? 80} onChange={(_, v) => onUpdate({ autoScaling: { ...cfg.autoScaling, targetMemPercent: v as number } })} valueLabelDisplay="auto" />
            </Box>
            <Field label="Cooldown (ticks)">
              <TextField type="number" size="small" value={cfg.autoScaling?.cooldownTicks ?? 3} slotProps={{ htmlInput: { min: 1, max: 50 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, cooldownTicks: Number(e.target.value) } })} sx={sxField} />
            </Field>
            <Field label="Scale Up Factor">
              <TextField type="number" size="small" value={cfg.autoScaling?.scaleUpFactor ?? 1.5} slotProps={{ htmlInput: { min: 1.1, max: 5, step: 0.1 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, scaleUpFactor: Number(e.target.value) } })} sx={sxField} />
            </Field>
            <Field label="Scale Down Factor">
              <TextField type="number" size="small" value={cfg.autoScaling?.scaleDownFactor ?? 0.5} slotProps={{ htmlInput: { min: 0.1, max: 0.9, step: 0.05 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, scaleDownFactor: Number(e.target.value) } })} sx={sxField} />
            </Field>
          </>
        )}
      </Section>

      <Divider />

      {/* Section 6 — AI/ML Config (conditional per node type) */}
      {nt === "LLMNode" && (
        <>
          <Section title="LLM Config">
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Prompt Tokens: {cfg.promptTokenCount ?? 0}</Typography>
              <Slider size="small" value={cfg.promptTokenCount ?? 512} min={64} max={4096} step={64}
                onChange={(_, v) => debouncedUpdate({ promptTokenCount: v as number })} valueLabelDisplay="auto" />
            </Box>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Completion Tokens: {cfg.completionTokenCount ?? 0}</Typography>
              <Slider size="small" value={cfg.completionTokenCount ?? 256} min={16} max={4096} step={16}
                onChange={(_, v) => debouncedUpdate({ completionTokenCount: v as number })} valueLabelDisplay="auto" />
            </Box>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Tokens Per Second: {cfg.tokensPerSecond ?? 0}</Typography>
              <Slider size="small" value={cfg.tokensPerSecond ?? 1000} min={100} max={10000} step={100}
                onChange={(_, v) => debouncedUpdate({ tokensPerSecond: v as number })} valueLabelDisplay="auto" />
            </Box>
            <Box sx={{ mt: 1, p: 1, bgcolor: "rgba(34,197,94,0.08)", borderRadius: 1, border: "1px solid rgba(34,197,94,0.2)" }}>
              <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, fontSize: "0.6rem", display: "block", mb: 0.5 }}>
                Token Pricing
              </Typography>
              <Field label="Input ($0.03/1K)">
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", fontSize: "0.65rem" }}>
                  ${((cfg.promptTokenCount ?? 0) / 1000 * 0.03).toFixed(4)}
                </Typography>
              </Field>
              <Field label="Output ($0.06/1K)">
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.primary", fontSize: "0.65rem" }}>
                  ${((cfg.completionTokenCount ?? 0) / 1000 * 0.06).toFixed(4)}
                </Typography>
              </Field>
              <Field label="Total">
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 600, fontSize: "0.65rem" }}>
                  ${((cfg.promptTokenCount ?? 0) / 1000 * 0.03 + (cfg.completionTokenCount ?? 0) / 1000 * 0.06).toFixed(4)}
                </Typography>
              </Field>
            </Box>
          </Section>
          <Divider />
        </>
      )}

      {nt === "VectorDB" && (
        <>
          <Section title="Vector DB Config">
            <Field label="Dimensions">
              <FormControl fullWidth size="small" sx={sxField}>
                <Select value={cfg.dimensions ?? 1536} onChange={(e) => debouncedUpdate({ dimensions: Number(e.target.value) })}>
                  <MenuItem value={128}>128</MenuItem>
                  <MenuItem value={256}>256</MenuItem>
                  <MenuItem value={768}>768</MenuItem>
                  <MenuItem value={1536}>1536</MenuItem>
                  <MenuItem value={3072}>3072</MenuItem>
                </Select>
              </FormControl>
            </Field>
            <Field label="Index Type">
              <FormControl fullWidth size="small" sx={sxField}>
                <Select value={cfg.indexType ?? "hnsw"} onChange={(e) => debouncedUpdate({ indexType: e.target.value })}>
                  <MenuItem value="hnsw">HNSW</MenuItem>
                  <MenuItem value="ivf">IVF</MenuItem>
                  <MenuItem value="flat">Flat (Brute-force)</MenuItem>
                  <MenuItem value="pq">Product Quantization</MenuItem>
                </Select>
              </FormControl>
            </Field>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Top-K: {cfg.topK ?? 10}</Typography>
              <Slider size="small" value={cfg.topK ?? 10} min={1} max={100} step={1}
                onChange={(_, v) => debouncedUpdate({ topK: v as number })} valueLabelDisplay="auto" />
            </Box>
          </Section>
          <Divider />
        </>
      )}

      {nt === "GPUCluster" && (
        <>
          <Section title="GPU Cluster Config">
            <Field label="VRAM (GB)">
              <TextField type="number" size="small" value={cfg.vramGB ?? 80} slotProps={{ htmlInput: { min: 16, max: 1024, step: 8 } }}
                onChange={(e) => debouncedUpdate({ vramGB: Number(e.target.value) })} sx={sxField} />
            </Field>
            <Field label="Model Size (GB)">
              <TextField type="number" size="small" value={cfg.modelSizeGB ?? 70} slotProps={{ htmlInput: { min: 0, max: 2048, step: 1 } }}
                onChange={(e) => debouncedUpdate({ modelSizeGB: Number(e.target.value) })} sx={sxField} />
            </Field>
            {metrics && (
              <Field label="CUDA Util">
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: metrics.cudaUtilization > 90 ? "#ef4444" : "text.secondary", fontSize: "0.65rem" }}>
                  {Math.round(metrics.cudaUtilization ?? 0)}%
                </Typography>
              </Field>
            )}
          </Section>
          <Divider />
        </>
      )}

      {nt === "EdgeCompute" && (
        <>
          <Section title="Edge Compute Config">
            <Field label="Execution Timeout">
              <TextField type="number" size="small" value={cfg.latencyMs ?? 10} slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                onChange={(e) => debouncedUpdate({ latencyMs: Number(e.target.value) })} sx={sxField} />
              <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.6rem", mt: 0.25, display: "block" }}>
                Simulation fails if P99 latency exceeds this value
              </Typography>
            </Field>
            <Field label="Cold Start">
              <TextField type="number" size="small" value={cfg.coldStartMs ?? 5} slotProps={{ htmlInput: { min: 0, max: 50, step: 1 } }}
                onChange={(e) => debouncedUpdate({ coldStartMs: Number(e.target.value) })} sx={sxField} />
            </Field>
            <FormControlLabel control={<Switch size="small" checked={cfg.geographicLatencyModifier === 0} onChange={(e) => debouncedUpdate({ geographicLatencyModifier: e.target.checked ? 0 : 1 })} />}
              label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Ignore Regional Latency</Typography>} />
          </Section>
          <Divider />
        </>
      )}

      {/* Orchestrator Failure Mode */}
      {nt === "Orchestrator" && (
        <>
          <Section title="Workflow Config">
            <Field label="Failure Mode">
              <FormControl fullWidth size="small" sx={sxField}>
                <Select value={cfg.failureMode ?? "compensate"} onChange={(e) => onUpdate({ failureMode: e.target.value })}>
                  <MenuItem value="compensate">Compensate (Rollback)</MenuItem>
                  <MenuItem value="retry">Retry</MenuItem>
                  <MenuItem value="panic">Panic</MenuItem>
                </Select>
              </FormControl>
            </Field>
          </Section>
          <Divider />
        </>
      )}

      {/* Section 7 — Deployment Strategy */}
      <Section title="Deployment Strategy">
        <Field label="Strategy">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={cfg.deployment.strategy} onChange={(e) => onUpdate({ deployment: { ...cfg.deployment, strategy: e.target.value as "rolling" | "blue_green" | "canary" } })}>
              {STRATEGIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Field>
        {cfg.deployment.strategy === "canary" && (
          <Box sx={{ px: 1 }}>
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Canary Traffic: {cfg.deployment.canaryPercent}%</Typography>
            <Slider size="small" value={cfg.deployment.canaryPercent} onChange={(_, v) => onUpdate({ deployment: { ...cfg.deployment, canaryPercent: v as number } })} valueLabelDisplay="auto" />
          </Box>
        )}
        {cfg.deployment.strategy === "blue_green" && (
          <Field label="Blue/Green Group">
            <TextField size="small" value={cfg.deployment.blueGreenGroup || ""} onChange={(e) => debouncedUpdate({ deployment: { ...cfg.deployment, blueGreenGroup: e.target.value } })} placeholder="blue or green" sx={sxField} />
          </Field>
        )}
        {cfg.deployment.strategy !== "rolling" && (
          <Field label="Canary Version">
            <TextField size="small" value={cfg.deployment.canaryVersion} onChange={(e) => debouncedUpdate({ deployment: { ...cfg.deployment, canaryVersion: e.target.value } })} placeholder="e.g. v2" sx={sxField} />
          </Field>
        )}
        {cfg.deployment.strategy !== "blue_green" && (
          <FormControlLabel control={<Switch size="small" checked={cfg.deployment.isCanaryActive} onChange={(e) => onUpdate({ deployment: { ...cfg.deployment, isCanaryActive: e.target.checked } })} />}
            label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Activate Canary</Typography>} />
        )}
      </Section>

      <Divider />

      {/* Section 7 — Security */}
      <Section title="Security">
        <FormControlLabel control={<Switch size="small" checked={cfg.security.isPublicFacing} onChange={(e) => onUpdate({ security: { ...cfg.security, isPublicFacing: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Public Facing</Typography>} />
        <FormControlLabel control={<Switch size="small" checked={cfg.security.requiresTLS} onChange={(e) => onUpdate({ security: { ...cfg.security, requiresTLS: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Requires TLS</Typography>} />
        <Field label="VPC ID">
          <TextField size="small" value={cfg.security.vpcId} onChange={(e) => debouncedUpdate({ security: { ...cfg.security, vpcId: e.target.value } })} placeholder="vpc-xxxx" sx={sxField} />
        </Field>
        <Box>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Allowed Inbound</Typography>
          <Box sx={{ maxHeight: 112, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: 1, p: 0.75 }}>
            {nodes.filter((n) => n.id !== node.id).length === 0 ? (
              <Typography variant="caption" sx={{ color: "text.disabled", display: "block", textAlign: "center", py: 0.5 }}>No other nodes available</Typography>
            ) : (
              nodes.filter((n) => n.id !== node.id).map((n) => {
                const checked = cfg.security.allowedInbound?.includes(n.id) ?? false;
                return (
                  <FormControlLabel key={n.id} control={<Switch size="small" checked={checked} onChange={() => {
                    const next = checked
                      ? (cfg.security.allowedInbound ?? []).filter((id: string) => id !== n.id)
                      : [...(cfg.security.allowedInbound ?? []), n.id];
                    onUpdate({ security: { ...cfg.security, allowedInbound: next } });
                  }} />} label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>{n.data?.label ?? n.id}</Typography>} sx={{ ml: 0 }} />
                );
              })
            )}
          </Box>
        </Box>
      </Section>

      <Divider />

      {/* Section 8 — Live Metrics */}
      {simRunning && (
        <Section title="Live Metrics">
          {metrics ? (
            <>
              <Field label="Current RPS"><MetricValue>{metrics.currentRPS.toLocaleString()}</MetricValue></Field>
              <Field label="CPU"><MetricValue>{Math.round(metrics.cpuPercent)}%</MetricValue></Field>
              <Field label="Memory"><MetricValue>{Math.round(metrics.memoryPercent)}%</MetricValue></Field>
              <Field label="Instances"><MetricValue>{cfg.instances}</MetricValue></Field>
              {cfg.autoScaling?.enabled && (
                <Field label="Desired Inst"><MetricValue>{metrics.desiredInstances ?? cfg.instances}</MetricValue></Field>
              )}
              {metrics.scalingEvent && (
                <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 500, display: "block", py: 0.5 }}>{metrics.scalingEvent}</Typography>
              )}
              <Field label="Queue Depth"><MetricValue>{metrics.queueDepth}</MetricValue></Field>
              <Field label="P99 Latency"><MetricValue>{metrics.p99LatencyMs}ms</MetricValue></Field>
              <Field label="Error Count"><MetricValue>{metrics.errorCount}</MetricValue></Field>
              {(cfg.replicationRole === "replica" && metrics.staleReadCount > 0) && (
                <Field label="Stale Reads"><MetricValue>{Math.round(metrics.staleReadCount)} req</MetricValue></Field>
              )}
              {cfg.replicationRole !== "none" && metrics.dataInconsistency > 0 && (
                <Field label="Data Inconsist."><MetricValue>{Math.round(metrics.dataInconsistency)}</MetricValue></Field>
              )}
              {metrics.isSplitBrain && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}><AlertTriangle size={14} /> Split-brain detected</Typography>
              )}
              {metrics.spotInterrupted && (
                <Typography variant="caption" sx={{ color: "#fb923c", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}><AlertTriangle size={14} /> Spot instance interrupted</Typography>
              )}
              {cfg.deployment.isCanaryActive && (
                <Field label="Canary RPS"><MetricValue>{(metrics as any).canaryRPS?.toLocaleString() ?? 0}</MetricValue></Field>
              )}
              {nt === "LLMNode" && (
                <>
                  <Field label="Tokens/Sec"><MetricValue>{metrics.tokensPerSecond?.toFixed(0) ?? 0}</MetricValue></Field>
                  <Field label="Prompt Tokens"><MetricValue>{metrics.promptTokenCount?.toFixed(0) ?? 0}</MetricValue></Field>
                  <Field label="Completion Tokens"><MetricValue>{metrics.completionTokenCount?.toFixed(0) ?? 0}</MetricValue></Field>
                </>
              )}
              {nt === "VectorDB" && (
                <Field label="Top-K Hits"><MetricValue>{metrics.topK ?? 0}</MetricValue></Field>
              )}
              {nt === "GPUCluster" && (
                <>
                  <Field label="VRAM Used"><MetricValue>{(metrics.vramGB ?? 0).toFixed(0)} GB</MetricValue></Field>
                  <Field label="CUDA Util"><MetricValue>{Math.round(metrics.cudaUtilization ?? 0)}%</MetricValue></Field>
                </>
              )}
              {nt === "EdgeCompute" && (
                <Field label="Cold Start"><MetricValue>{metrics.coldStartMs ?? 0}ms</MetricValue></Field>
              )}
              {nt === "Orchestrator" && (
                <>
                  <Field label="Active WFs"><MetricValue>{metrics.activeWorkflows ?? 0}</MetricValue></Field>
                  <Field label="Failed WFs"><MetricValue>{metrics.failedWorkflows ?? 0}</MetricValue></Field>
                  <Field label="Compensations"><MetricValue>{metrics.compensationEvents ?? 0}</MetricValue></Field>
                </>
              )}
              {metrics.isFailed && nt === "GPUCluster" && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}>
                  <AlertTriangle size={14} /> OOM — model exceeds VRAM
                </Typography>
              )}
              {metrics.isFailed && nt === "EdgeCompute" && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}>
                  <AlertTriangle size={14} /> Timeout — exceeded {cfg.latencyMs || 30}ms limit
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="caption" sx={{ color: "text.disabled", display: "block", textAlign: "center", py: 1 }}>No metrics available</Typography>
          )}
        </Section>
      )}
    </motion.div>
  );
}

function MetricValue({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      key={String(children)}
      variant="caption"
      sx={{ fontFamily: "monospace", color: "text.primary", fontSize: "0.65rem", animation: "metric-flash 0.6s ease-out" }}
    >
      {children}
    </Typography>
  );
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

  if (!routing) return <Box sx={{ p: 2, color: "error.main", fontSize: "0.75rem" }}>Missing routing config</Box>;

  const srcNode = nodes.find((n) => n.id === edge.source);
  const tgtNode = nodes.find((n) => n.id === edge.target);
  const srcLabel = srcNode?.data?.label ?? edge.source;
  const tgtLabel = tgtNode?.data?.label ?? edge.target;

  return (
    <motion.div key="edge" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.75rem" }}>Edge Connection</Typography>
        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 0.5, fontSize: "0.65rem" }}>
          {srcLabel} <ArrowRight size={12} style={{ display: "inline" }} /> {tgtLabel}
        </Typography>
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Field label="Protocol">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={routing.protocol} onChange={(e) => onUpdate({ routing: { ...routing, protocol: e.target.value } })}>
              {PROTOCOLS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
        </Field>

        <FormControlLabel control={<Switch size="small" checked={routing.isSync} onChange={(e) => onUpdate({ routing: { ...routing, isSync: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Synchronous</Typography>} />
        <FormControlLabel control={<Switch size="small" checked={routing.requiresTLS} onChange={(e) => onUpdate({ routing: { ...routing, requiresTLS: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Requires TLS</Typography>} />

        <Box sx={{ px: 1 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Traffic: {routing.trafficPercent}%</Typography>
          <Slider size="small" value={routing.trafficPercent} onChange={(_, v) => onUpdate({ routing: { ...routing, trafficPercent: v as number } })} valueLabelDisplay="auto" />
        </Box>

        <Divider />

        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.6rem" }}>Network Physics</Typography>

        <Box sx={{ px: 1 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", display: "block", mb: 0.5 }}>Packet Loss: {routing.packetLoss ?? 0}%</Typography>
          <Slider size="small" value={routing.packetLoss ?? 0} min={0} max={5} step={0.1} onChange={(_, v) => onUpdate({ routing: { ...routing, packetLoss: v as number } })} valueLabelDisplay="auto" />
        </Box>

        <Field label="Jitter">
          <TextField type="number" size="small" value={routing.jitterMs ?? 0} slotProps={{ htmlInput: { min: 0, max: 500, step: 1 } }}
            onChange={(e) => onUpdate({ routing: { ...routing, jitterMs: Number(e.target.value) } })} sx={sxField} />
        </Field>

        <Divider />

        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.6rem" }}>Stats</Typography>

        <Field label="Throughput"><MonoSpan>{edge.data?.throughputRPS ?? 0} RPS</MonoSpan></Field>
        <Field label="Latency"><MonoSpan>{edge.data?.latencyMs ?? 0}ms</MonoSpan></Field>

        <FormControlLabel control={<Switch size="small" checked={edge.data?.isAnimated ?? false} onChange={(e) => onUpdate({ isAnimated: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Animated</Typography>} />
        <FormControlLabel control={<Switch size="small" checked={edge.data?.isSaturated ?? false} onChange={(e) => onUpdate({ isSaturated: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Saturated</Typography>} />
        <FormControlLabel control={<Switch size="small" checked={edge.data?.isSecure ?? true} onChange={(e) => onUpdate({ isSecure: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary" }}>Secure</Typography>} />
      </Box>
    </motion.div>
  );
}

function MonoSpan({ children }: { children: React.ReactNode }) {
  return <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: "0.65rem" }}>{children}</Typography>;
}
