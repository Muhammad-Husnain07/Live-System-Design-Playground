import { useCallback, useRef } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { NodeType, NodeConfig, NodeMetrics, EdgeRoutingConfig } from "../../types/canvas";
import { tokens } from "../../theme/tokens";
import { TextField, Slider, FormControl, Select, MenuItem, Switch, FormControlLabel, Chip, Divider, Typography, Box } from "@mui/material";

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "sa-east-1"];
const CLOUD_PROVIDERS = ["aws", "gcp", "azure"];
const PROTOCOLS = ["HTTP", "gRPC", "TCP", "WebSocket", "AMQP", "Replication"] as const;
const STRATEGIES = ["rolling", "blue_green", "canary"] as const;

const sxField = { "& .MuiInputBase-root": { fontSize: "0.7rem" }, "& .MuiInputLabel-root": { fontSize: "0.7rem" } };

const thinSliderSx = {
  height: 4, py: 0.5,
  "& .MuiSlider-thumb": { height: 10, width: 10, "&:before": { boxShadow: "0 1px 3px rgba(0,0,0,0.4)" } },
  "& .MuiSlider-track": { height: 4, border: "none" },
  "& .MuiSlider-rail": { height: 4 },
};

const compactSwitchSx = { mx: 0, width: "100%", justifyContent: "space-between", "& .MuiSwitch-root": { ml: 1 } };

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
    <Box sx={{ px: 2, py: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.55rem", whiteSpace: "nowrap", userSelect: "none" }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: 0, borderTop: "1px solid", borderColor: "divider" }} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>{children}</Box>
    </Box>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem", display: "block", mb: 0.25, userSelect: "none" }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "flex", gap: 1.5, "& > *": { flex: 1, minWidth: 0 } }}>{children}</Box>;
}

function MonoSpan({ children }: { children: React.ReactNode }) {
  return <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: "text.secondary", fontSize: "0.65rem" }}>{children}</Typography>;
}

/* ------------------------------------------------------------------ */
/*  Node config sections                                                */
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
        <SmallField label="Label">
          <TextField size="small" value={label ?? ""} onChange={(e) => onUpdateLabel?.(e.target.value)} placeholder="Node label" sx={sxField} />
        </SmallField>
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
        <FieldRow>
          <SmallField label="Region">
            <FormControl fullWidth size="small" sx={sxField}>
              <Select value={cfg.region} onChange={(e) => onUpdate({ region: e.target.value })}>
                {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </SmallField>
          <SmallField label="Cloud Provider">
            <FormControl fullWidth size="small" sx={sxField}>
              <Select value={cfg.cloudProvider ?? "aws"} onChange={(e) => onUpdate({ cloudProvider: e.target.value })}>
                {CLOUD_PROVIDERS.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
              </Select>
            </FormControl>
          </SmallField>
        </FieldRow>
      </Section>

      <Divider />

      {/* Section 2 — Capacity */}
      <Section title="Capacity">
        <FieldRow>
          <SmallField label="Instances">
            <TextField type="number" size="small" value={cfg.instances} slotProps={{ htmlInput: { min: 1, max: 100 } }}
              onChange={(e) => debouncedUpdate({ instances: Math.max(1, Number(e.target.value)) })} sx={sxField} />
          </SmallField>
          <SmallField label="Max RPS">
            <TextField type="number" size="small" value={cfg.maxRPS} slotProps={{ htmlInput: { min: 0 } }}
              onChange={(e) => debouncedUpdate({ maxRPS: Math.max(0, Number(e.target.value)) })} sx={sxField} />
          </SmallField>
        </FieldRow>
        <FieldRow>
          <SmallField label="Latency">
            <TextField type="number" size="small" value={cfg.latencyMs} slotProps={{ htmlInput: { min: 0 } }}
              onChange={(e) => debouncedUpdate({ latencyMs: Math.max(0, Number(e.target.value)) })} sx={sxField} />
          </SmallField>
          <SmallField label="Compute Tier">
            <FormControl fullWidth size="small" sx={sxField}>
              <Select value={cfg.computeTier ?? "on_demand"} onChange={(e) => onUpdate({ computeTier: e.target.value as "on_demand" | "reserved" | "spot" })}>
                <MenuItem value="on_demand">On-Demand</MenuItem>
                <MenuItem value="reserved">Reserved 1yr</MenuItem>
                <MenuItem value="spot">Spot</MenuItem>
              </Select>
            </FormControl>
          </SmallField>
        </FieldRow>
      </Section>

      <Divider />

      {/* Section 3 — Reliability */}
      <Section title="Reliability">
        <SmallField label="Error Rate">
          <Slider size="small" value={cfg.errorRate * 100} onChange={(_, v) => onUpdate({ errorRate: (v as number) / 100 })}
            valueLabelDisplay="auto" valueLabelFormat={(v) => `${Math.round(v)}%`} sx={thinSliderSx} />
        </SmallField>
        <FormControlLabel control={<Switch size="small" checked={cfg.isFailed} onChange={(e) => onUpdate({ isFailed: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Failed</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <FormControlLabel control={<Switch size="small" checked={cfg.isBottleneck} onChange={(e) => onUpdate({ isBottleneck: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Bottleneck</Typography>} labelPlacement="start" sx={compactSwitchSx} />
      </Section>

      <Divider />

      {/* Section 4 — Replication */}
      {cfg.replicationRole !== undefined && (
        <>
          <Section title="Replication">
            <FieldRow>
              <SmallField label="Role">
                <FormControl fullWidth size="small" sx={sxField}>
                  <Select value={cfg.replicationRole} onChange={(e) => onUpdate({ replicationRole: e.target.value })}>
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="replica">Replica</MenuItem>
                  </Select>
                </FormControl>
              </SmallField>
              {cfg.replicationRole === "replica" && (
                <SmallField label="Lag (ms)">
                  <TextField type="number" size="small" value={cfg.replicationLagMs} slotProps={{ htmlInput: { min: 0, max: 5000, step: 10 } }}
                    onChange={(e) => debouncedUpdate({ replicationLagMs: Number(e.target.value) })} sx={sxField} />
                </SmallField>
              )}
            </FieldRow>
          </Section>
          <Divider />
        </>
      )}

      {/* Section 5 — Auto-Scaling */}
      <Section title="Auto-Scaling">
        <FormControlLabel control={<Switch size="small" checked={cfg.autoScaling?.enabled ?? false} onChange={(e) => onUpdate({ autoScaling: { ...cfg.autoScaling, enabled: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Enabled</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        {(cfg.autoScaling?.enabled || (cfg.autoScaling && !simRunning)) && (
          <>
            <FieldRow>
              <SmallField label="Min Instances">
                <TextField type="number" size="small" value={cfg.autoScaling?.minInstances ?? 1} slotProps={{ htmlInput: { min: 1, max: 100 } }}
                  onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, minInstances: Number(e.target.value) } })} sx={sxField} />
              </SmallField>
              <SmallField label="Max Instances">
                <TextField type="number" size="small" value={cfg.autoScaling?.maxInstances ?? 10} slotProps={{ htmlInput: { min: 1, max: 500 } }}
                  onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, maxInstances: Number(e.target.value) } })} sx={sxField} />
              </SmallField>
            </FieldRow>
            <SmallField label="CPU Target">
              <Slider size="small" value={cfg.autoScaling?.targetCPUPercent ?? 70} onChange={(_, v) => onUpdate({ autoScaling: { ...cfg.autoScaling, targetCPUPercent: v as number } })}
                valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} sx={thinSliderSx} />
            </SmallField>
            <SmallField label="Memory Target">
              <Slider size="small" value={cfg.autoScaling?.targetMemPercent ?? 80} onChange={(_, v) => onUpdate({ autoScaling: { ...cfg.autoScaling, targetMemPercent: v as number } })}
                valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} sx={thinSliderSx} />
            </SmallField>
            <FieldRow>
              <SmallField label="Cooldown">
                <TextField type="number" size="small" value={cfg.autoScaling?.cooldownTicks ?? 3} slotProps={{ htmlInput: { min: 1, max: 50 } }}
                  onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, cooldownTicks: Number(e.target.value) } })} sx={sxField} />
              </SmallField>
              <SmallField label="Scale Up">
                <TextField type="number" size="small" value={cfg.autoScaling?.scaleUpFactor ?? 1.5} slotProps={{ htmlInput: { min: 1.1, max: 5, step: 0.1 } }}
                  onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, scaleUpFactor: Number(e.target.value) } })} sx={sxField} />
              </SmallField>
            </FieldRow>
            <SmallField label="Scale Down">
              <TextField type="number" size="small" value={cfg.autoScaling?.scaleDownFactor ?? 0.5} slotProps={{ htmlInput: { min: 0.1, max: 0.9, step: 0.05 } }}
                onChange={(e) => debouncedUpdate({ autoScaling: { ...cfg.autoScaling, scaleDownFactor: Number(e.target.value) } })} sx={sxField} />
            </SmallField>
          </>
        )}
      </Section>

      <Divider />

      {/* Section 6 — AI/ML Config (conditional per node type) */}
      {nt === "LLMNode" && (
        <>
          <Section title="LLM Config">
            <SmallField label="Prompt Tokens">
              <Slider size="small" value={cfg.promptTokenCount ?? 512} min={64} max={4096} step={64}
                onChange={(_, v) => debouncedUpdate({ promptTokenCount: v as number })} valueLabelDisplay="auto" sx={thinSliderSx} />
            </SmallField>
            <SmallField label="Completion Tokens">
              <Slider size="small" value={cfg.completionTokenCount ?? 256} min={16} max={4096} step={16}
                onChange={(_, v) => debouncedUpdate({ completionTokenCount: v as number })} valueLabelDisplay="auto" sx={thinSliderSx} />
            </SmallField>
            <SmallField label="Tokens / Sec">
              <Slider size="small" value={cfg.tokensPerSecond ?? 1000} min={100} max={10000} step={100}
                onChange={(_, v) => debouncedUpdate({ tokensPerSecond: v as number })} valueLabelDisplay="auto" sx={thinSliderSx} />
            </SmallField>
            <Box sx={{ mt: 1, p: 1, bgcolor: "rgba(34,197,94,0.08)", borderRadius: 1, border: "1px solid rgba(34,197,94,0.2)" }}>
              <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, fontSize: "0.6rem", display: "block", mb: 0.5 }}>
                Token Pricing
              </Typography>
              <SmallField label="Input ($0.03/1K)">
                <MonoSpan>${((cfg.promptTokenCount ?? 0) / 1000 * 0.03).toFixed(4)}</MonoSpan>
              </SmallField>
              <SmallField label="Output ($0.06/1K)">
                <MonoSpan>${((cfg.completionTokenCount ?? 0) / 1000 * 0.06).toFixed(4)}</MonoSpan>
              </SmallField>
              <SmallField label="Total">
                <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: "success.main", fontWeight: 600, fontSize: "0.65rem" }}>
                  ${((cfg.promptTokenCount ?? 0) / 1000 * 0.03 + (cfg.completionTokenCount ?? 0) / 1000 * 0.06).toFixed(4)}
                </Typography>
              </SmallField>
            </Box>
          </Section>
          <Divider />
        </>
      )}

      {nt === "VectorDB" && (
        <>
          <Section title="Vector DB Config">
            <FieldRow>
              <SmallField label="Dimensions">
                <FormControl fullWidth size="small" sx={sxField}>
                  <Select value={cfg.dimensions ?? 1536} onChange={(e) => debouncedUpdate({ dimensions: Number(e.target.value) })}>
                    <MenuItem value={128}>128</MenuItem>
                    <MenuItem value={256}>256</MenuItem>
                    <MenuItem value={768}>768</MenuItem>
                    <MenuItem value={1536}>1536</MenuItem>
                    <MenuItem value={3072}>3072</MenuItem>
                  </Select>
                </FormControl>
              </SmallField>
              <SmallField label="Index Type">
                <FormControl fullWidth size="small" sx={sxField}>
                  <Select value={cfg.indexType ?? "hnsw"} onChange={(e) => debouncedUpdate({ indexType: e.target.value })}>
                    <MenuItem value="hnsw">HNSW</MenuItem>
                    <MenuItem value="ivf">IVF</MenuItem>
                    <MenuItem value="flat">Flat</MenuItem>
                    <MenuItem value="pq">PQ</MenuItem>
                  </Select>
                </FormControl>
              </SmallField>
            </FieldRow>
            <SmallField label="Top-K">
              <Slider size="small" value={cfg.topK ?? 10} min={1} max={100} step={1}
                onChange={(_, v) => debouncedUpdate({ topK: v as number })} valueLabelDisplay="auto" sx={thinSliderSx} />
            </SmallField>
          </Section>
          <Divider />
        </>
      )}

      {nt === "GPUCluster" && (
        <>
          <Section title="GPU Cluster">
            <FieldRow>
              <SmallField label="VRAM (GB)">
                <TextField type="number" size="small" value={cfg.vramGB ?? 80} slotProps={{ htmlInput: { min: 16, max: 1024, step: 8 } }}
                  onChange={(e) => debouncedUpdate({ vramGB: Number(e.target.value) })} sx={sxField} />
              </SmallField>
              <SmallField label="Model Size (GB)">
                <TextField type="number" size="small" value={cfg.modelSizeGB ?? 70} slotProps={{ htmlInput: { min: 0, max: 2048, step: 1 } }}
                  onChange={(e) => debouncedUpdate({ modelSizeGB: Number(e.target.value) })} sx={sxField} />
              </SmallField>
            </FieldRow>
            {metrics && (
              <SmallField label="CUDA Util">
                <MonoSpan>{Math.round(metrics.cudaUtilization ?? 0)}%</MonoSpan>
              </SmallField>
            )}
          </Section>
          <Divider />
        </>
      )}

      {nt === "EdgeCompute" && (
        <>
          <Section title="Edge Compute">
            <FieldRow>
              <SmallField label="Exec Timeout">
                <TextField type="number" size="small" value={cfg.latencyMs ?? 10} slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                  onChange={(e) => debouncedUpdate({ latencyMs: Number(e.target.value) })} sx={sxField} />
              </SmallField>
              <SmallField label="Cold Start">
                <TextField type="number" size="small" value={cfg.coldStartMs ?? 5} slotProps={{ htmlInput: { min: 0, max: 50, step: 1 } }}
                  onChange={(e) => debouncedUpdate({ coldStartMs: Number(e.target.value) })} sx={sxField} />
              </SmallField>
            </FieldRow>
            <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.6rem", mt: 0.25, display: "block" }}>
              Fails if P99 latency exceeds timeout
            </Typography>
            <FormControlLabel control={<Switch size="small" checked={cfg.geographicLatencyModifier === 0} onChange={(e) => debouncedUpdate({ geographicLatencyModifier: e.target.checked ? 0 : 1 })} />}
              label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Ignore Regional Latency</Typography>} labelPlacement="start" sx={compactSwitchSx} />
          </Section>
          <Divider />
        </>
      )}

      {nt === "Orchestrator" && (
        <>
          <Section title="Workflow">
            <SmallField label="Failure Mode">
              <FormControl fullWidth size="small" sx={sxField}>
                <Select value={cfg.failureMode ?? "compensate"} onChange={(e) => onUpdate({ failureMode: e.target.value })}>
                  <MenuItem value="compensate">Compensate</MenuItem>
                  <MenuItem value="retry">Retry</MenuItem>
                  <MenuItem value="panic">Panic</MenuItem>
                </Select>
              </FormControl>
            </SmallField>
          </Section>
          <Divider />
        </>
      )}

      {/* Section 7 — Deployment Strategy */}
      <Section title="Deployment">
        <SmallField label="Strategy">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={cfg.deployment.strategy} onChange={(e) => onUpdate({ deployment: { ...cfg.deployment, strategy: e.target.value as "rolling" | "blue_green" | "canary" } })}>
              {STRATEGIES.map((s) => <MenuItem key={s} value={s}>{s.replace("_", " ")}</MenuItem>)}
            </Select>
          </FormControl>
        </SmallField>
        {cfg.deployment.strategy === "canary" && (
          <SmallField label="Canary Traffic">
            <Slider size="small" value={cfg.deployment.canaryPercent} onChange={(_, v) => onUpdate({ deployment: { ...cfg.deployment, canaryPercent: v as number } })}
              valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} sx={thinSliderSx} />
          </SmallField>
        )}
        {cfg.deployment.strategy === "blue_green" && (
          <SmallField label="Blue/Green Group">
            <TextField size="small" value={cfg.deployment.blueGreenGroup || ""} onChange={(e) => debouncedUpdate({ deployment: { ...cfg.deployment, blueGreenGroup: e.target.value } })} placeholder="blue or green" sx={sxField} />
          </SmallField>
        )}
        {cfg.deployment.strategy !== "rolling" && (
          <SmallField label="Canary Version">
            <TextField size="small" value={cfg.deployment.canaryVersion} onChange={(e) => debouncedUpdate({ deployment: { ...cfg.deployment, canaryVersion: e.target.value } })} placeholder="e.g. v2" sx={sxField} />
          </SmallField>
        )}
        {cfg.deployment.strategy !== "blue_green" && (
          <FormControlLabel control={<Switch size="small" checked={cfg.deployment.isCanaryActive} onChange={(e) => onUpdate({ deployment: { ...cfg.deployment, isCanaryActive: e.target.checked } })} />}
            label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Canary Active</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        )}
      </Section>

      <Divider />

      {/* Section 8 — Security */}
      <Section title="Security">
        <FormControlLabel control={<Switch size="small" checked={cfg.security.isPublicFacing} onChange={(e) => onUpdate({ security: { ...cfg.security, isPublicFacing: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Public Facing</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <FormControlLabel control={<Switch size="small" checked={cfg.security.requiresTLS} onChange={(e) => onUpdate({ security: { ...cfg.security, requiresTLS: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>TLS</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <SmallField label="VPC ID">
          <TextField size="small" value={cfg.security.vpcId} onChange={(e) => debouncedUpdate({ security: { ...cfg.security, vpcId: e.target.value } })} placeholder="vpc-xxxx" sx={sxField} />
        </SmallField>
        <Box>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem", display: "block", mb: 0.5 }}>Allowed Inbound</Typography>
          <Box sx={{ maxHeight: 112, overflowY: "auto", border: 1, borderColor: "divider", borderRadius: 1, p: 0.75 }}>
            {nodes.filter((n) => n.id !== node.id).length === 0 ? (
              <Typography variant="caption" sx={{ color: "text.disabled", display: "block", textAlign: "center", py: 0.5 }}>No other nodes</Typography>
            ) : (
              nodes.filter((n) => n.id !== node.id).map((n) => {
                const checked = cfg.security.allowedInbound?.includes(n.id) ?? false;
                return (
                  <FormControlLabel key={n.id} control={<Switch size="small" checked={checked} onChange={() => {
                    const next = checked
                      ? (cfg.security.allowedInbound ?? []).filter((id: string) => id !== n.id)
                      : [...(cfg.security.allowedInbound ?? []), n.id];
                    onUpdate({ security: { ...cfg.security, allowedInbound: next } });
                  }} />} label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>{n.data?.label ?? n.id}</Typography>}
                    labelPlacement="start" sx={{ mx: 0, width: "100%", justifyContent: "space-between", "& .MuiSwitch-root": { ml: 1 } }} />
                );
              })
            )}
          </Box>
        </Box>
      </Section>

      <Divider />

      {/* Section 9 — Live Metrics */}
      {simRunning && (
        <Section title="Live Metrics">
          {metrics ? (
            <>
              <MetricRow label="RPS" value={metrics.currentRPS.toLocaleString()} ratio={Math.min(metrics.currentRPS / (cfg.maxRPS || 1), 1)} color={tokens.metric.rps} />
              <MetricRow label="CPU" value={`${Math.round(metrics.cpuPercent)}%`} ratio={metrics.cpuPercent / 100} color={tokens.metric.cpu} />
              <MetricRow label="MEM" value={`${Math.round(metrics.memoryPercent)}%`} ratio={metrics.memoryPercent / 100} color={tokens.metric.memory} />
              <MetricRow label="Instances" value={String(cfg.instances)} />
              {cfg.autoScaling?.enabled && (
                <MetricRow label="Desired" value={String(metrics.desiredInstances ?? cfg.instances)} />
              )}
              {metrics.scalingEvent && (
                <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 500, display: "block", py: 0.5, fontSize: "0.6rem" }}>{metrics.scalingEvent}</Typography>
              )}
              <MetricRow label="Queue" value={String(metrics.queueDepth)} />
              <MetricRow label="P99" value={`${metrics.p99LatencyMs}ms`} />
              <MetricRow label="Errors" value={String(metrics.errorCount)} />
              {(cfg.replicationRole === "replica" && metrics.staleReadCount > 0) && (
                <MetricRow label="Stale Reads" value={`${Math.round(metrics.staleReadCount)} req`} />
              )}
              {cfg.replicationRole !== "none" && metrics.dataInconsistency > 0 && (
                <MetricRow label="Data Inconsist." value={String(Math.round(metrics.dataInconsistency))} />
              )}
              {metrics.isSplitBrain && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5, fontSize: "0.6rem" }}><AlertTriangle size={12} /> Split-brain</Typography>
              )}
              {metrics.spotInterrupted && (
                <Typography variant="caption" sx={{ color: "#fb923c", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5, fontSize: "0.6rem" }}><AlertTriangle size={12} /> Spot interrupted</Typography>
              )}
              {cfg.deployment.isCanaryActive && (
                <MetricRow label="Canary RPS" value={(metrics as any).canaryRPS?.toLocaleString() ?? "0"} />
              )}
              {nt === "LLMNode" && (
                <>
                  <MetricRow label="TPS" value={(metrics.tokensPerSecond?.toFixed(0) ?? "0")} />
                  <MetricRow label="Prompt Tok" value={(metrics.promptTokenCount?.toFixed(0) ?? "0")} />
                  <MetricRow label="Comp. Tok" value={(metrics.completionTokenCount?.toFixed(0) ?? "0")} />
                </>
              )}
              {nt === "VectorDB" && (
                <MetricRow label="Top-K Hits" value={String(metrics.topK ?? 0)} />
              )}
              {nt === "GPUCluster" && (
                <>
                  <MetricRow label="VRAM" value={`${(metrics.vramGB ?? 0).toFixed(0)} GB`} />
                  <MetricRow label="CUDA" value={`${Math.round(metrics.cudaUtilization ?? 0)}%`} />
                </>
              )}
              {nt === "EdgeCompute" && (
                <MetricRow label="Cold Start" value={`${metrics.coldStartMs ?? 0}ms`} />
              )}
              {nt === "Orchestrator" && (
                <>
                  <MetricRow label="Active WFs" value={String(metrics.activeWorkflows ?? 0)} />
                  <MetricRow label="Failed WFs" value={String(metrics.failedWorkflows ?? 0)} />
                  <MetricRow label="Compensations" value={String(metrics.compensationEvents ?? 0)} />
                </>
              )}
              {(metrics as any)?.isFailed && nt === "GPUCluster" && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5, fontSize: "0.6rem" }}>
                  <AlertTriangle size={12} /> OOM — exceeds VRAM
                </Typography>
              )}
              {(metrics as any)?.isFailed && nt === "EdgeCompute" && (
                <Typography variant="caption" sx={{ color: "error.main", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, py: 0.5, fontSize: "0.6rem" }}>
                  <AlertTriangle size={12} /> Timeout — exceeded {cfg.latencyMs || 30}ms
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="caption" sx={{ color: "text.disabled", textAlign: "center", py: 1, display: "block", fontSize: "0.65rem" }}>No metrics available</Typography>
          )}
        </Section>
      )}
    </motion.div>
  );
}

function MetricRow({ label, value, ratio, color }: { label: string; value: string; ratio?: number; color?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 20 }}>
      <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem", width: 56, flexShrink: 0, userSelect: "none" }}>
        {label}
      </Typography>
      {color !== undefined && ratio !== undefined && (
        <Box sx={{ width: 32, height: 20, display: "flex", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
          <Box sx={{ width: 4, height: Math.max(3, Math.round(ratio * 20)), borderRadius: "1px 1px 0 0", bgcolor: color, transition: "height 0.2s" }} />
        </Box>
      )}
      <Box sx={{ flex: 1, textAlign: "right" }}>
        <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: color || "text.primary", fontSize: "0.65rem", fontWeight: color ? 600 : 400 }}>
          {value}
        </Typography>
      </Box>
    </Box>
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
      <Section title="Connection">
        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", fontSize: "0.65rem" }}>
          {srcLabel} <ArrowRight size={12} style={{ display: "inline" }} /> {tgtLabel}
        </Typography>
      </Section>

      <Divider />

      <Section title="Protocol">
        <SmallField label="Type">
          <FormControl fullWidth size="small" sx={sxField}>
            <Select value={routing.protocol} onChange={(e) => onUpdate({ routing: { ...routing, protocol: e.target.value } })}>
              {PROTOCOLS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
        </SmallField>
        <FormControlLabel control={<Switch size="small" checked={routing.isSync} onChange={(e) => onUpdate({ routing: { ...routing, isSync: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Synchronous</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <FormControlLabel control={<Switch size="small" checked={routing.requiresTLS} onChange={(e) => onUpdate({ routing: { ...routing, requiresTLS: e.target.checked } })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>TLS</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <SmallField label="Traffic">
          <Slider size="small" value={routing.trafficPercent} onChange={(_, v) => onUpdate({ routing: { ...routing, trafficPercent: v as number } })}
            valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} sx={thinSliderSx} />
        </SmallField>
      </Section>

      <Divider />

      <Section title="Network Physics">
        <SmallField label="Packet Loss">
          <Slider size="small" value={routing.packetLoss ?? 0} min={0} max={5} step={0.1} onChange={(_, v) => onUpdate({ routing: { ...routing, packetLoss: v as number } })}
            valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} sx={thinSliderSx} />
        </SmallField>
        <SmallField label="Jitter">
          <TextField type="number" size="small" value={routing.jitterMs ?? 0} slotProps={{ htmlInput: { min: 0, max: 500, step: 1 } }}
            onChange={(e) => onUpdate({ routing: { ...routing, jitterMs: Number(e.target.value) } })} sx={sxField} />
        </SmallField>
      </Section>

      <Divider />

      <Section title="Stats">
        <FieldRow>
          <SmallField label="Throughput">
            <MonoSpan>{edge.data?.throughputRPS ?? 0} RPS</MonoSpan>
          </SmallField>
          <SmallField label="Latency">
            <MonoSpan>{edge.data?.latencyMs ?? 0}ms</MonoSpan>
          </SmallField>
        </FieldRow>
        <FormControlLabel control={<Switch size="small" checked={edge.data?.isAnimated ?? false} onChange={(e) => onUpdate({ isAnimated: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Animated</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <FormControlLabel control={<Switch size="small" checked={edge.data?.isSaturated ?? false} onChange={(e) => onUpdate({ isSaturated: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Saturated</Typography>} labelPlacement="start" sx={compactSwitchSx} />
        <FormControlLabel control={<Switch size="small" checked={edge.data?.isSecure ?? true} onChange={(e) => onUpdate({ isSecure: e.target.checked })} />}
          label={<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>Secure</Typography>} labelPlacement="start" sx={compactSwitchSx} />
      </Section>
    </motion.div>
  );
}
