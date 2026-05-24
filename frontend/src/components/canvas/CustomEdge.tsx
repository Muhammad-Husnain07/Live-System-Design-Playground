import { memo, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { useChaosStore } from "../../store/chaosStore";
import { useSecurityStore } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import type { CanvasEdge } from "../../types/canvas";

type CustomEdgeData = CanvasEdge["data"];

const PROTOCOL_COLORS: Record<string, string> = {
  HTTP: "#3B82F6",
  HTTPS: "#22C55E",
  gRPC: "#A855F7",
  TCP: "#F97316",
  UDP: "#06B6D4",
  WebSocket: "#EC4899",
  AMQP: "#F59E0B",
  Kafka: "#EF4444",
};

const PROTOCOL_DISPLAY: Record<string, string> = {
  AMQP: "AMQP",
  Kafka: "Kfk",
};

function getProtocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? "#a1a1aa";
}

function CustomEdge({
  id,
  source, target,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
  selected,
}: EdgeProps<CustomEdgeData>) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const routing = data?.routing;
  const isSaturated = data?.isSaturated ?? false;
  const isAnimated = data?.isAnimated ?? false;
  const isSync = routing?.isSync ?? true;
  const isSecure = data?.isSecure ?? true;
  const requiresTLS = routing?.requiresTLS ?? false;
  const protocol = routing?.protocol ?? "HTTP";
  const trafficPercent = routing?.trafficPercent ?? 100;
  const throughput = data?.throughputRPS ?? 0;
  const latency = data?.latencyMs ?? 0;

  const hasChaos = useChaosStore((s) => s.activeNodeIds.includes(source) || s.activeNodeIds.includes(target));
  const isSecurityHighlighted = useSecurityStore((s) => s.highlightedEdgeIds.includes(id));
  const { hasCanary, edgeCanaryPct } = useCanvasStore(
    useShallow((s) => {
      const srcNode = s.nodes.find((n) => n.id === source);
      if (!srcNode) return { hasCanary: false, edgeCanaryPct: 0 };
      const dep = srcNode.data?.config?.deployment;
      const hc = dep?.strategy === "canary" && dep?.isCanaryActive;
      const metrics = srcNode.data?.metrics;
      const pct = metrics?.currentRPS > 0
        ? Math.round((metrics.canaryRPS / metrics.currentRPS) * 100)
        : 0;
      return { hasCanary: hc, edgeCanaryPct: pct };
    }),
  );

  const baseColor = getProtocolColor(protocol);

  let strokeColor = baseColor;
  let strokeDasharray: string | undefined;
  let strokeWidth = selected ? 3.5 : 2;
  let opacity = 0.8;

  if (isSaturated) {
    strokeColor = "#F97316";
    opacity = 1;
  }
  if (!isSync) {
    strokeDasharray = "10 5";
    opacity = 0.7;
  }
  if (!isSecure && requiresTLS) {
    strokeColor = "#EF4444";
    strokeDasharray = "6 4";
    opacity = 1;
  }
  if (hasChaos && !isSaturated) {
    strokeColor = "#F97316";
    strokeDasharray = "2 3";
  }
  if (isSecurityHighlighted) {
    strokeColor = "#EF4444";
    strokeDasharray = "6 3";
  }

  const animDuration = isSync ? "0.8s" : "3s";

  return (
    <g
      className={hasChaos ? "animate-chaos-flash" : ""}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {hasCanary ? (
        <>
          <BaseEdge
            id={`${id}-stable`}
            path={edgePath}
            style={{
              stroke: "#3B82F6",
              strokeWidth,
              strokeDasharray: isAnimated ? "4 4" : strokeDasharray,
              opacity,
            }}
          />
          <BaseEdge
            id={`${id}-canary`}
            path={edgePath}
            style={{
              stroke: "#A855F7",
              strokeWidth,
              strokeDasharray: "4 4",
              opacity: 0.85,
            }}
          />
          <circle r={3} fill="#A855F7" opacity={0.9}>
            <animateMotion dur="0.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      ) : (
        <>
          <BaseEdge
            id={id}
            path={edgePath}
            style={{
              stroke: strokeColor,
              strokeWidth,
              strokeDasharray,
              opacity,
              filter: selected ? "drop-shadow(0 0 4px rgba(96,165,250,0.5))" : undefined,
            }}
          />
          {/* Protocol label */}
          {hovered && !isSecurityHighlighted && (
            <g>
              <rect
                x={labelX - 32}
                y={labelY - 10}
                width={64}
                height={16}
                rx={3}
                fill="#18181b"
                stroke={baseColor}
                strokeWidth={1}
                opacity={0.95}
              />
              <text
                x={labelX}
                y={labelY + 3}
                textAnchor="middle"
                fill={baseColor}
                fontSize={8}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {PROTOCOL_DISPLAY[protocol] ?? protocol}
              </text>
            </g>
          )}
        </>
      )}

      {/* Traffic dots */}
      {!hasCanary && (isAnimated || hasChaos) && (
        <circle r={hasChaos ? 5 : isSync ? 3 : 4} fill={strokeColor} opacity={0.85}>
          <animateMotion dur={hasChaos ? "0.3s" : animDuration} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Security indicator */}
      {isSecurityHighlighted && (
        <g>
          <rect
            x={labelX - 50}
            y={labelY - 18}
            width={100}
            height={20}
            rx={4}
            fill="#18181b"
            stroke="#EF4444"
            strokeWidth={1}
          />
          <text x={labelX} y={labelY - 4} textAnchor="middle" fill="#EF4444" fontSize={10} fontFamily="monospace" fontWeight="bold">
            Insecure
          </text>
        </g>
      )}

      {/* Secure/insecure icon */}
      {!isSecurityHighlighted && (isSecure || !requiresTLS) && (
        <text x={labelX + 12} y={labelY - 6} textAnchor="middle" fill={strokeColor} fontSize={9} opacity={selected ? 1 : 0.5}>
          TLS
        </text>
      )}
      {!isSecurityHighlighted && !isSecure && requiresTLS && (
        <text x={labelX + 12} y={labelY - 6} textAnchor="middle" fill="#EF4444" fontSize={9}>
          NoTLS
        </text>
      )}

      {/* Hover tooltip */}
      {hovered && routing && !hasCanary && (
        <g>
          <rect
            x={labelX - 56}
            y={labelY + 12}
            width={112}
            height={28}
            rx={4}
            fill="#18181b"
            stroke="#3f3f46"
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={labelX}
            y={labelY + 24}
            textAnchor="middle"
            fill="#a1a1aa"
            fontSize={7}
            fontFamily="monospace"
          >
            {throughput.toLocaleString()} RPS · {latency}ms · {trafficPercent}% traffic
          </text>
          <text
            x={labelX}
            y={labelY + 34}
            textAnchor="middle"
            fill={isSync ? "#3B82F6" : "#F97316"}
            fontSize={7}
            fontFamily="monospace"
          >
            {isSync ? "Synchronous" : "Asynchronous"}
          </text>
        </g>
      )}
      {hovered && hasCanary && (
        <g>
          <rect
            x={labelX - 56}
            y={labelY + 12}
            width={112}
            height={22}
            rx={4}
            fill="#18181b"
            stroke="#3f3f46"
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={labelX}
            y={labelY + 26}
            textAnchor="middle"
            fill="#A855F7"
            fontSize={7}
            fontFamily="monospace"
          >
            Canary {edgeCanaryPct}% · Stable {100 - edgeCanaryPct}%
          </text>
        </g>
      )}
    </g>
  );
}

export default memo(CustomEdge);
