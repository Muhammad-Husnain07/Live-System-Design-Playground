import { memo, useMemo } from "react";
import type { Node } from "reactflow";
import { useCanvasStore } from "../../store/canvasStore";

interface HeatmapOverlayProps {
  nodes: Node[];
}

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
        const cpuRatio = Math.min(cpu / 100, 1);
        const stress = cpuRatio;
        const intensity = 0.1 + stress * 0.28;
        const radius = 80 + stress * 140;
        const x = n.position.x + 110;
        const y = n.position.y + 60;

        let r: number, g: number, b: number;
        if (stress < 0.3) {
          r = 59; g = 130 + stress * 100; b = 246;
        } else if (stress < 0.6) {
          r = 130 + (stress - 0.3) * 120;
          g = 160 - (stress - 0.3) * 80;
          b = 246 - (stress - 0.3) * 200;
        } else {
          r = Math.min(255, 166 + (stress - 0.6) * 200);
          g = Math.max(40, 136 - (stress - 0.6) * 200);
          b = Math.max(20, 80 - (stress - 0.6) * 150);
        }

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
            <stop offset="50%" stopColor={`rgba(${h.r},${h.g},${h.b},${h.intensity * 0.4})`} />
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
