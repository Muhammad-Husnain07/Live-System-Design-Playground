import { memo, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";
import { useChaosStore } from "../../store/chaosStore";
import { useSecurityStore } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import type { CanvasEdge } from "../../types/canvas";

type CustomEdgeData = CanvasEdge["data"];

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

  const activeNodeIds = useChaosStore((s) => s.activeNodeIds);
  const hasChaos = activeNodeIds.includes(source) || activeNodeIds.includes(target);

  const highlightedEdgeIds = useSecurityStore((s) => s.highlightedEdgeIds);
  const isSecurityHighlighted = highlightedEdgeIds.includes(id);

  const nodes = useCanvasStore((s) => s.nodes);
  const sourceNode = nodes.find((n) => n.id === source);
  const srcDeploy = sourceNode?.data?.config?.deployment;
  const hasCanary = srcDeploy?.strategy === "canary" && srcDeploy?.isCanaryActive;
  const srcMetrics = sourceNode?.data?.metrics;
  const edgeCanaryPct = srcMetrics && srcMetrics.currentRPS > 0
    ? Math.round((srcMetrics.canaryRPS / srcMetrics.currentRPS) * 100)
    : 0;

  let strokeColor = "#a1a1aa";
  let strokeDasharray: string | undefined;
  let strokeWidth = selected ? 3 : 2;

  if (isSaturated) {
    strokeColor = "#F97316";
  }

  if (!isSync) {
    strokeDasharray = "8 4";
  }

  if (!isSecure && requiresTLS) {
    strokeColor = "#EF4444";
    strokeDasharray = "6 4";
  }

  if (hasChaos && !isSaturated) {
    strokeColor = "#F97316";
  }

  if (isSecurityHighlighted) {
    strokeColor = "#EF4444";
    strokeDasharray = "6 3";
  }

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
          <circle r={3} fill="#A855F7">
            <animateMotion dur="0.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      ) : (
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: hasChaos ? "2 3" : isAnimated ? (isSync ? "4 4" : "8 4") : strokeDasharray,
          }}
        />
      )}

      {!hasCanary && (isAnimated || hasChaos) && (
        <circle r={hasChaos ? 5 : isSync ? 3 : 4} fill={strokeColor}>
          <animateMotion dur={hasChaos ? "0.3s" : isSync ? "0.8s" : "3s"} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {isSecurityHighlighted && (
        <text x={labelX} y={labelY - 8} textAnchor="middle" fill="#EF4444" fontSize={14} fontWeight="bold">
          🔓
        </text>
      )}

      {hovered && routing && (
        <g>
          <rect
            x={labelX - 52}
            y={labelY - 22}
            width={104}
            height={24}
            rx={3}
            fill="#18181b"
            stroke="#3f3f46"
            strokeWidth={1}
          />
          <text
            x={labelX}
            y={labelY - 10}
            textAnchor="middle"
            fill="#a1a1aa"
            fontSize={8}
            fontFamily="monospace"
          >
            {routing.protocol} | {routing.trafficPercent}% | {data?.throughputRPS ?? 0} RPS
          </text>
          {hasCanary && (
            <text
              x={labelX}
              y={labelY + 2}
              textAnchor="middle"
              fill="#A855F7"
              fontSize={7}
              fontFamily="monospace"
            >
              Canary {edgeCanaryPct}% | Stable {100 - edgeCanaryPct}%
            </text>
          )}
        </g>
      )}
    </g>
  );
}

export default memo(CustomEdge);
