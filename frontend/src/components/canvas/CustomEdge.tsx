import { memo, useState, useMemo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { useChaosStore } from "../../store/chaosStore";
import { useSecurityStore } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import { NODE_REGISTRY } from "../../utils/nodeRegistry";
import type { CanvasEdge } from "../../types/canvas";

type CustomEdgeData = CanvasEdge["data"];

const PROTOCOL_DISPLAY: Record<string, string> = {
  AMQP: "AMQP", Kafka: "Kfk", ServiceMesh: "Mesh",
};

function getNodeColor(nodeId: string): string {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
  const nt = node?.data?.nodeType as string | undefined;
  if (nt && NODE_REGISTRY[nt as keyof typeof NODE_REGISTRY]) {
    return (NODE_REGISTRY[nt as keyof typeof NODE_REGISTRY] as any).color ?? "#3E3E44";
  }
  return "#3E3E44";
}

function CustomEdge({
  id, source, target,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data, selected,
}: EdgeProps<CustomEdgeData>) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 12,
  });

  const routing = data?.routing;
  const isAnimated = data?.isAnimated ?? false;
  const isSync = routing?.isSync ?? true;
  const isSecure = data?.isSecure ?? true;
  const requiresTLS = routing?.requiresTLS ?? false;
  const authRequired = routing?.authRequired ?? false;
  const protocol = routing?.protocol ?? "HTTP";
  const trafficPercent = routing?.trafficPercent ?? 100;
  const throughput = data?.throughputRPS ?? 0;
  const latency = data?.latencyMs ?? 0;

  const hasChaos = useChaosStore((s) => s.activeNodeIds.includes(source) || s.activeNodeIds.includes(target));
  const isSecurityHighlighted = useSecurityStore((s) => s.highlightedEdgeIds.includes(id));

  const violations = useSecurityStore((s) => s.violations);
  const isImplicitTrust = useMemo(() =>
    violations.some((v) =>
      v.type === "implicit_trust" &&
      ((v.sourceNodeId === source && v.targetNodeId === target) ||
       (v.sourceNodeId === target && v.targetNodeId === source))
    ),
    [violations, source, target]
  );

  const isMTLS = requiresTLS && authRequired;
  const serviceMeshMTLS = useCanvasStore(
    useShallow((s) => {
      const srcNode = s.nodes.find((n) => n.id === source);
      const tgtNode = s.nodes.find((n) => n.id === target);
      const srcIsMesh = srcNode?.data?.nodeType === "ServiceMesh" && srcNode?.data?.config?.mtlsEnabled;
      const tgtIsMesh = tgtNode?.data?.nodeType === "ServiceMesh" && tgtNode?.data?.config?.mtlsEnabled;
      return srcIsMesh || tgtIsMesh;
    })
  );

  const { hasCanary, edgeCanaryPct, ragStep } = useCanvasStore(
    useShallow((s) => {
      const srcNode = s.nodes.find((n) => n.id === source);
      const tgtNode = s.nodes.find((n) => n.id === target);
      if (!srcNode) return { hasCanary: false, edgeCanaryPct: 0, ragStep: 0 };
      const dep = srcNode.data?.config?.deployment;
      const hc = dep?.strategy === "canary" && dep?.isCanaryActive;
      const metrics = srcNode.data?.metrics;
      const pct = metrics?.currentRPS > 0 ? Math.round((metrics.canaryRPS / metrics.currentRPS) * 100) : 0;
      let step = 0;
      const srcT = srcNode.data?.nodeType;
      const tgtT = tgtNode?.data?.nodeType;
      if (srcT === "LLMNode" && tgtT === "VectorDB") {
        const hasIncomingRag = s.edges.some((e) => {
          const n = s.nodes.find((n) => n.id === e.source);
          return e.target === source && n?.data?.nodeType === "VectorDB";
        });
        step = hasIncomingRag ? 3 : 1;
      } else if (srcT === "VectorDB" && tgtT === "LLMNode") { step = 2; }
      return { hasCanary: hc, edgeCanaryPct: pct, ragStep: step };
    }),
  );

  const sourceColor = useMemo(() => getNodeColor(source), [source]);
  const targetColor = useMemo(() => getNodeColor(target), [target]);

  const gradientId = `edge-grad-${id.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const laserId = `edge-laser-${id.replace(/[^a-zA-Z0-9]/g, "_")}`;

  let opacity = 0.7;
  if (selected || isSecurityHighlighted || isImplicitTrust) opacity = 1;
  if (isImplicitTrust) opacity = 1;
  else if (!isSync) opacity = 0.55;
  if (!isImplicitTrust && !isSecure && requiresTLS) opacity = 1;

  const isEnergyFlowing = isAnimated || hasChaos;
  const animDuration = isSync ? "1.2s" : "4s";

  const baseWidth = throughput <= 0 ? 1.5 : throughput < 1000 ? 2 : throughput < 5000 ? 3 : throughput < 10000 ? 4 : 5;
  const edgeWidth = selected ? baseWidth + 0.5 : baseWidth;

  const isSaturated = data?.isSaturated ?? false;

  return (
    <g
      className={`${hasChaos ? "animate-chaos-flash" : ""} ${isSaturated ? "edge-saturated-pulse" : ""}`.trim() || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
        <linearGradient id={laserId} x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={sourceColor} stopOpacity="0" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={targetColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {hasCanary ? (
        <>
          <BaseEdge id={`${id}-stable`} path={edgePath}
            style={{ stroke: "#3B82F6", strokeWidth: selected ? Math.max(edgeWidth, 2) : Math.max(edgeWidth - 0.5, 1.5), strokeDasharray: isAnimated ? "4 4" : undefined, opacity }} />
          <BaseEdge id={`${id}-canary`} path={edgePath}
            style={{ stroke: "#A855F7", strokeWidth: selected ? Math.max(edgeWidth, 2) : Math.max(edgeWidth - 0.5, 1.5), strokeDasharray: "4 4", opacity: 0.85 }} />
          <circle r={2.5} fill="#A855F7" opacity={0.9}>
            <animateMotion dur="0.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      ) : (
        <>
          <BaseEdge id={id} path={edgePath}
            style={{
              stroke: `url(#${gradientId})`,
              strokeWidth: edgeWidth,
              opacity,
              filter: selected ? "drop-shadow(0 0 4px rgba(99,102,241,0.4))" : "drop-shadow(0 0 2px rgba(255,255,255,0.1))",
            }}
          />

          {isEnergyFlowing && (
            <path d={edgePath} fill="none"
              stroke={`url(#${laserId})`}
              strokeWidth={edgeWidth + 1}
              opacity={0.9}
              style={{
                animation: `laser-beam ${animDuration} linear infinite`,
                filter: "brightness(2) drop-shadow(0 0 3px rgba(255,255,255,0.3))",
              }}
            />
          )}

          {!isSync && !hasCanary && (
            <BaseEdge id={`${id}-async`} path={edgePath}
              style={{ stroke: `url(#${gradientId})`, strokeWidth: edgeWidth, strokeDasharray: "4 4", opacity: 0.4,
                animation: "edge-dash 0.6s linear infinite",
              }} />
          )}

          {isSaturated && (
            <BaseEdge id={`${id}-saturated`} path={edgePath}
              style={{ stroke: "#f97316", strokeWidth: edgeWidth + 1, strokeDasharray: "4 3", opacity: 0.5,
                animation: "edge-saturated-pulse 0.5s ease-in-out infinite",
              }} />
          )}

          {isImplicitTrust && (
            <BaseEdge id={`${id}-implicit`} path={edgePath}
              style={{ stroke: "#EF4444", strokeWidth: edgeWidth, strokeDasharray: "6 4", opacity: 1 }} />
          )}
          {!isImplicitTrust && !isSecure && requiresTLS && (
            <BaseEdge id={`${id}-notls`} path={edgePath}
              style={{ stroke: "#EF4444", strokeWidth: edgeWidth, strokeDasharray: "6 4", opacity: 1 }} />
          )}
          {isSecurityHighlighted && (
            <BaseEdge id={`${id}-sec`} path={edgePath}
              style={{ stroke: "#EF4444", strokeWidth: edgeWidth + 0.5, strokeDasharray: "6 3", opacity: 1 }} />
          )}
          {hovered && !isSecurityHighlighted && (
            <g>
              <rect x={labelX - 28} y={labelY - 8} width={56} height={14} rx={3}
                fill="#141415" stroke={sourceColor} strokeWidth={0.5} opacity={0.95} />
              <text x={labelX} y={labelY + 3} textAnchor="middle" fill={sourceColor} fontSize={7} fontFamily="monospace" fontWeight="bold">
                {PROTOCOL_DISPLAY[protocol] ?? protocol}
              </text>
            </g>
          )}
        </>
      )}

      {!hasCanary && !isEnergyFlowing && (isAnimated || hasChaos) && (
        <circle r={2} fill={sourceColor} opacity={0.8}>
          <animateMotion dur={hasChaos ? "0.4s" : animDuration} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {ragStep > 0 && (
        <g>
          <rect x={labelX - 8} y={labelY - 22} width={16} height={14} rx={3}
            fill={ragStep === 1 ? "#8B5CF6" : ragStep === 2 ? "#A855F7" : "#7C3AED"} opacity={0.9}>
            <animate attributeName="opacity" values="0.9; 0.5; 0.9" dur={`${0.5 + ragStep * 0.3}s`} repeatCount="indefinite" />
          </rect>
          <text x={labelX} y={labelY - 11} textAnchor="middle" fill="#fff" fontSize={7} fontFamily="monospace" fontWeight="bold">{ragStep}</text>
        </g>
      )}

      {isSecurityHighlighted && (
        <g>
          <rect x={labelX - 40} y={labelY - 14} width={80} height={16} rx={4}
            fill="#141415" stroke="#EF4444" strokeWidth={0.5} />
          <text x={labelX} y={labelY - 2} textAnchor="middle" fill="#EF4444" fontSize={8} fontFamily="monospace" fontWeight="bold">Insecure</text>
        </g>
      )}

      {(isMTLS || serviceMeshMTLS) && !isImplicitTrust && (
        <text x={labelX - 24} y={labelY - 6} textAnchor="middle" fontSize={12} fill="#14B8A6">\uD83D\uDD12</text>
      )}
      {isImplicitTrust && (
        <text x={labelX - 24} y={labelY - 6} textAnchor="middle" fontSize={12} fill="#EF4444">\uD83D\uDD13</text>
      )}

      {!isImplicitTrust && !isSecurityHighlighted && (isSecure || !requiresTLS) && (
        <text x={labelX + 10} y={labelY - 4} textAnchor="middle" fill={sourceColor} fontSize={8} opacity={selected ? 1 : 0.4}>TLS</text>
      )}
      {!isImplicitTrust && !isSecurityHighlighted && !isSecure && requiresTLS && (
        <text x={labelX + 10} y={labelY - 4} textAnchor="middle" fill="#EF4444" fontSize={8}>NoTLS</text>
      )}

      {hovered && routing && !hasCanary && (
        <g>
          <rect x={labelX - 48} y={labelY + 10} width={96} height={30} rx={4}
            fill="#141415" stroke="#2A2A2E" strokeWidth={0.5} opacity={0.95} />
          <text x={labelX} y={labelY + 20} textAnchor="middle" fill="#a1a1aa" fontSize={6} fontFamily="monospace">
            {throughput.toLocaleString()} RPS \u00B7 {latency}ms \u00B7 {trafficPercent}% traffic
          </text>
          <text x={labelX} y={labelY + 28} textAnchor="middle" fill={isSync ? "#3B82F6" : "#F97316"} fontSize={6} fontFamily="monospace">
            {isSync ? "Synchronous" : "Asynchronous"}
          </text>
          {(isMTLS || serviceMeshMTLS) && (
            <text x={labelX} y={labelY + 36} textAnchor="middle" fill="#14B8A6" fontSize={6} fontFamily="monospace">mTLS \uD83D\uDD12</text>
          )}
        </g>
      )}
      {hovered && hasCanary && (
        <g>
          <rect x={labelX - 48} y={labelY + 10} width={96} height={18} rx={4}
            fill="#141415" stroke="#2A2A2E" strokeWidth={0.5} opacity={0.95} />
          <text x={labelX} y={labelY + 22} textAnchor="middle" fill="#A855F7" fontSize={6} fontFamily="monospace">
            Canary {edgeCanaryPct}% \u00B7 Stable {100 - edgeCanaryPct}%
          </text>
        </g>
      )}
    </g>
  );
}

export default memo(CustomEdge);
