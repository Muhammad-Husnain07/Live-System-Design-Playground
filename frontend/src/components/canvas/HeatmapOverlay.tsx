import { memo, useMemo } from "react";
import type { Node } from "reactflow";
import { useCanvasStore } from "../../store/canvasStore";

interface HeatmapOverlayProps {
  nodes: Node[];
}

const MAX_RPS = 10000;
const MAX_CPU = 100;

function gradientId(index: number) {
  return `heat-grad-${index}`;
}

export default memo(function HeatmapOverlay({ nodes }: HeatmapOverlayProps) {
  const isSimRunning = useCanvasStore((s) => s.isSimulationRunning);
  const simulationSpeed = useCanvasStore((s) => s.simulationSpeed);

  const heats = useMemo(() => {
    if (!isSimRunning) return [];
    return nodes
      .filter((n) => n.position && n.data?.metrics)
      .map((n, i) => {
        const metrics = n.data.metrics;
        const currentRPS = metrics.currentRPS ?? 0;
        const cpu = metrics.cpuPercent ?? 0;
        const rpsRatio = Math.min(currentRPS / MAX_RPS, 1);
        const cpuRatio = Math.min(cpu / MAX_CPU, 1);
        const stress = Math.max(rpsRatio, cpuRatio);
        const intensity = 0.12 + stress * 0.25;
        const r = Math.round(128 + stress * 127);
        const g = Math.round(64 - stress * 50);
        const b = Math.round(200 - stress * 180);
        const radius = 80 + stress * 120;
        const x = n.position.x + 110;
        const y = n.position.y + 60;
        return { i, x, y, radius, r, g, b, intensity, stress };
      });
  }, [nodes, isSimRunning, simulationSpeed]);

  if (!isSimRunning || heats.length === 0) return null;

  return (
    <>
      <defs>
        {heats.map((h) => (
          <radialGradient key={h.i} id={gradientId(h.i)} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${h.r},${h.g},${h.b},${h.intensity})`} />
            <stop offset="40%" stopColor={`rgba(${h.r},${h.g},${h.b},${h.intensity * 0.5})`} />
            <stop offset="100%" stopColor={`rgba(${h.r},${h.g},${h.b},0)`} />
          </radialGradient>
        ))}
      </defs>
      {heats.map((h) => (
        <circle
          key={h.i}
          cx={h.x}
          cy={h.y}
          r={h.radius}
          fill={`url(#${gradientId(h.i)})`}
          pointerEvents="none"
        />
      ))}
    </>
  );
});
