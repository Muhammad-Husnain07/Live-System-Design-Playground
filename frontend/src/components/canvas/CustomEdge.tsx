import { memo, useState, useMemo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { useChaosStore } from "../../store/chaosStore";
import { useSecurityStore } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import type { CanvasEdge } from "../../types/canvas";

type CustomEdgeData = CanvasEdge["data"];

const PROTOCOL_DISPLAY: Record<string, string> = {
  AMQP: "AMQP", Kafka: "Kfk", ServiceMesh: "Mesh",
};

const DEFAULT_COLOR = "#3E3E44";
const SELECTED_COLOR = "#6366F1";
const SATURATED_COLOR = "#F59E0B";
const ERROR_COLOR = "#EF4444";

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
  const isSaturated = data?.isSaturated ?? false;
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

  // Determine stroke color
  let strokeColor = DEFAULT_COLOR;
  let strokeDasharray: string | undefined;
  let strokeWidth = selected ? 2 : 1.5;
  let opacity = 0.7;

  if (isImplicitTrust) {
    strokeColor = ERROR_COLOR;
    strokeDasharray = "6 4";
    opacity = 1;
  } else if (selected) {
    strokeColor = SELECTED_COLOR;
    opacity = 1;
    strokeWidth = 2;
  } else if (isSaturated) {
    strokeColor = SATURATED_COLOR;
    opacity = 0.9;
  }

  if (!isImplicitTrust && !isSync) {
    strokeDasharray = "8 4";
    opacity = 0.55;
  }
  if (!isImplicitTrust && !isSecure && requiresTLS) {
    strokeColor = ERROR_COLOR;
    strokeDasharray = "6 4";
    opacity = 1;
  }
  if (!isImplicitTrust && hasChaos && !isSaturated) {
    strokeColor = SATURATED_COLOR;
    strokeDasharray = "3 3";
  }
  if (isSecurityHighlighted) {
    strokeColor = ERROR_COLOR;
    strokeDasharray = "6 3";
  }

  const animDuration = isSync ? "1.2s" : "4s";

  return (
    <g
      className={hasChaos ? "animate-chaos-flash" : ""}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {hasCanary ? (
        <>
          <BaseEdge id={`${id}-stable`} path={edgePath}
            style={{ stroke: "#3B82F6", strokeWidth, strokeDasharray: isAnimated ? "4 4" : strokeDasharray, opacity }} />
          <BaseEdge id={`${id}-canary`} path={edgePath}
            style={{ stroke: "#A855F7", strokeWidth, strokeDasharray: "4 4", opacity: 0.85 }} />
          <circle r={2.5} fill="#A855F7" opacity={0.9}>
            <animateMotion dur="0.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      ) : (
        <>
          <BaseEdge id={id} path={edgePath}
            style={{
              stroke: strokeColor, strokeWidth, strokeDasharray, opacity,
              filter: selected ? "drop-shadow(0 0 3px rgba(99,102,241,0.3))" : undefined,
            }}
          />
          {hovered && !isSecurityHighlighted && (
            <g>
              <rect x={labelX - 28} y={labelY - 8} width={56} height={14} rx={3}
                fill="#141415" stroke={strokeColor} strokeWidth={0.5} opacity={0.95} />
              <text x={labelX} y={labelY + 3} textAnchor="middle" fill={strokeColor} fontSize={7} fontFamily="monospace" fontWeight="bold">
                {PROTOCOL_DISPLAY[protocol] ?? protocol}
              </text>
            </g>
          )}
        </>
      )}

      {/* Animated dots */}
      {!hasCanary && (isAnimated || hasChaos) && (
        <circle r={2} fill={strokeColor} opacity={0.8}>
          <animateMotion dur={hasChaos ? "0.4s" : animDuration} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* RAG step badge */}
      {ragStep > 0 && (
        <g>
          <rect x={labelX - 8} y={labelY - 22} width={16} height={14} rx={3}
            fill={ragStep === 1 ? "#8B5CF6" : ragStep === 2 ? "#A855F7" : "#7C3AED"} opacity={0.9}>
            <animate attributeName="opacity" values="0.9; 0.5; 0.9" dur={`${0.5 + ragStep * 0.3}s`} repeatCount="indefinite" />
          </rect>
          <text x={labelX} y={labelY - 11} textAnchor="middle" fill="#fff" fontSize={7} fontFamily="monospace" fontWeight="bold">{ragStep}</text>
        </g>
      )}

      {/* Security indicator */}
      {isSecurityHighlighted && (
        <g>
          <rect x={labelX - 40} y={labelY - 14} width={80} height={16} rx={4}
            fill="#141415" stroke={ERROR_COLOR} strokeWidth={0.5} />
          <text x={labelX} y={labelY - 2} textAnchor="middle" fill={ERROR_COLOR} fontSize={8} fontFamily="monospace" fontWeight="bold">Insecure</text>
        </g>
      )}

      {/* mTLS / Unsecured ZTA indicator */}
      {(isMTLS || serviceMeshMTLS) && !isImplicitTrust && (
        <text x={labelX - 24} y={labelY - 6} textAnchor="middle" fontSize={12} fill="#14B8A6">🔒</text>
      )}
      {isImplicitTrust && (
        <text x={labelX - 24} y={labelY - 6} textAnchor="middle" fontSize={12} fill={ERROR_COLOR}>🔓</text>
      )}

      {/* TLS / NoTLS text */}
      {!isImplicitTrust && !isSecurityHighlighted && (isSecure || !requiresTLS) && (
        <text x={labelX + 10} y={labelY - 4} textAnchor="middle" fill={strokeColor} fontSize={8} opacity={selected ? 1 : 0.4}>TLS</text>
      )}
      {!isImplicitTrust && !isSecurityHighlighted && !isSecure && requiresTLS && (
        <text x={labelX + 10} y={labelY - 4} textAnchor="middle" fill={ERROR_COLOR} fontSize={8}>NoTLS</text>
      )}

      {/* Hover tooltip */}
      {hovered && routing && !hasCanary && (
        <g>
          <rect x={labelX - 48} y={labelY + 10} width={96} height={30} rx={4}
            fill="#141415" stroke="#2A2A2E" strokeWidth={0.5} opacity={0.95} />
          <text x={labelX} y={labelY + 20} textAnchor="middle" fill="#a1a1aa" fontSize={6} fontFamily="monospace">
            {throughput.toLocaleString()} RPS · {latency}ms · {trafficPercent}% traffic
          </text>
          <text x={labelX} y={labelY + 28} textAnchor="middle" fill={isSync ? "#3B82F6" : "#F97316"} fontSize={6} fontFamily="monospace">
            {isSync ? "Synchronous" : "Asynchronous"}
          </text>
          {(isMTLS || serviceMeshMTLS) && (
            <text x={labelX} y={labelY + 36} textAnchor="middle" fill="#14B8A6" fontSize={6} fontFamily="monospace">mTLS 🔒</text>
          )}
        </g>
      )}
      {hovered && hasCanary && (
        <g>
          <rect x={labelX - 48} y={labelY + 10} width={96} height={18} rx={4}
            fill="#141415" stroke="#2A2A2E" strokeWidth={0.5} opacity={0.95} />
          <text x={labelX} y={labelY + 22} textAnchor="middle" fill="#A855F7" fontSize={6} fontFamily="monospace">
            Canary {edgeCanaryPct}% · Stable {100 - edgeCanaryPct}%
          </text>
        </g>
      )}
    </g>
  );
}

export default memo(CustomEdge);
