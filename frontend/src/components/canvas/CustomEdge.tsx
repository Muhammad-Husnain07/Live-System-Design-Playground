import { memo, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";
import { useChaosStore } from "../../store/chaosStore";
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

  return (
    <g
      className={hasChaos ? "animate-chaos-flash" : ""}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: hasChaos ? "2 3" : isAnimated ? (isSync ? "4 4" : "8 4") : strokeDasharray,
        }}
      />

      {(isAnimated || hasChaos) && (
        <circle r={hasChaos ? 5 : isSync ? 3 : 4} fill={strokeColor}>
          <animateMotion dur={hasChaos ? "0.3s" : isSync ? "0.8s" : "3s"} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {hovered && routing && (
        <g>
          <rect
            x={labelX - 44}
            y={labelY - 22}
            width={88}
            height={18}
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
        </g>
      )}
    </g>
  );
}

export default memo(CustomEdge);
