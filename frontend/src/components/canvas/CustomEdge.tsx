import { memo, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";
import type { CanvasEdge } from "../../types/canvas";

type CustomEdgeData = CanvasEdge["data"];

function CustomEdge({
  id,
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

  return (
    <g
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
          strokeDasharray: isAnimated ? "8 4" : strokeDasharray,
        }}
      />

      {isAnimated && (
        <circle r="3" fill={strokeColor}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
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
