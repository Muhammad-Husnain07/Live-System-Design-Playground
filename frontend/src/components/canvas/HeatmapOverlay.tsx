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
        const cpu = metrics.cpuPercent ?? 0;
        const cpuRatio = Math.min(cpu / MAX_CPU, 1);
        const intensity = 0.12 + cpuRatio * 0.25;
        let r: number, g: number, b: number;
        if (cpu < 30) {
          r = 59; g = 130; b = 246;
        } else if (cpu < 60) {
          const t = (cpu - 30) / 30;
          r = Math.round(59 + t * (251 - 59));
          g = Math.round(130 - t * (130 - 146));
          b = Math.round(246 - t * (246 - 20));
        } else {
          r = 251; g = 146; b = 20;
        }
        const radius = 80 + cpuRatio * 120;
        const x = n.position.x + 110;
        const y = n.position.y + 60;
        return { i, x, y, radius, r, g, b, intensity };
      });
  }, [nodes, isSimRunning, simulationSpeed]);

  if (!isSimRunning || heats.length === 0) return null;

  return (
    <>
      <defs>
        {heats.map((h) => (
          <radialGradient key={h.i} id={gradientId(h.i)} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${h.r},${h.g},${h.b},${h.intensity})`} />
            <stop offset="60%" stopColor={`rgba(${h.r},${h.g},${h.b},${h.intensity * 0.3})`} />
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
