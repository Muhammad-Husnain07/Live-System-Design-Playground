import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useIncidentStore } from "../../store/incidentStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useSimulationStore } from "../../store/simulationStore";

const ACTION_COLORS: Record<string, string> = {
  chaos_inject: "#ef4444",
  traffic_spike: "#fb923c",
  config_change: "#3b82f6",
};

export default function IncidentTimeline() {
  const activeScenario = useIncidentStore((s) => s.activeScenario);
  const timelineMarkers = useIncidentStore((s) => s.timelineMarkers);
  const setHighlightedNodeIds = useCanvasStore((s) => s.setHighlightedNodeIds);
  const latestTick = useSimulationStore((s) => s.latestTick);

  const currentTick = latestTick?.tickNumber ?? 0;

  const totalTicks = useMemo(() => {
    if (!activeScenario) return 30;
    const maxTick = Math.max(...activeScenario.steps.map((s) => s.triggerTick), 1);
    return Math.max(currentTick + 10, maxTick + 5);
  }, [activeScenario, currentTick]);

  if (!activeScenario) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>
          Select and trigger an incident scenario to see the timeline
        </Typography>
      </Box>
    );
  }

  const allSteps = activeScenario.steps;
  const minTick = 0;
  const maxTick = totalTicks;
  const range = maxTick - minTick || 1;

  const handleMarkerClick = (stepIndex: number) => {
    const step = allSteps[stepIndex];
    const nodeType =
      step.action === "chaos_inject"
        ? "AppServer"
        : step.action === "config_change"
          ? "AppServer"
          : undefined;

    const nodes = useCanvasStore.getState().nodes;
    if (nodeType) {
      const ids = nodes
        .filter((n) => n.data?.nodeType === nodeType)
        .map((n) => n.id);
      setHighlightedNodeIds(ids.length > 0 ? ids : []);
    } else {
      setHighlightedNodeIds([]);
    }
    setTimeout(() => setHighlightedNodeIds([]), 3000);
  };

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", px: 2, py: 1 }}>
      <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 500, color: "#a1a1aa", display: "block", mb: 1 }}>
        Incident Timeline — {activeScenario.name}
      </Typography>
      <Box sx={{ position: "relative", flex: 1, display: "flex", alignItems: "flex-start", pt: 2 }}>
        <svg width="100%" height="48" style={{ overflow: "visible" }}>
          <rect x="0" y="20" width="100%" height="3" rx="1.5" fill="#27272a" />

          {allSteps.map((step, i) => {
            const xPct = ((step.triggerTick - minTick) / range) * 100;
            const isPast = timelineMarkers.some((m) => m.stepIndex === i);

            return (
              <g key={i} onClick={() => handleMarkerClick(i)} style={{ cursor: "pointer" }}>
                <line
                  x1={`${xPct}%`}
                  y1="14"
                  x2={`${xPct}%`}
                  y2="28"
                  stroke={isPast ? ACTION_COLORS[step.action] : "#3f3f46"}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle
                  cx={`${xPct}%`}
                  cy="21"
                  r={isPast ? 6 : 4}
                  fill={isPast ? ACTION_COLORS[step.action] : "#3f3f46"}
                  stroke={isPast ? "#18181b" : "none"}
                  strokeWidth={1.5}
                />
                {isPast && (
                  <circle
                    cx={`${xPct}%`}
                    cy="21"
                    r={10}
                    fill="none"
                    stroke={ACTION_COLORS[step.action]}
                    strokeWidth={1}
                    opacity={0.3}
                  />
                )}
                <text
                  x={`${xPct}%`}
                  y="8"
                  textAnchor="middle"
                  fill={isPast ? "#a1a1aa" : "#52525b"}
                  fontSize="8"
                  fontFamily="monospace"
                >
                  T+{step.triggerTick}
                </text>
                <foreignObject x={`${xPct}%`} y="30" width="120" height="40" style={{ transform: `translateX(-50%)`, overflow: "visible" }}>
                  <Box
                    sx={{
                      bgcolor: isPast ? `${ACTION_COLORS[step.action]}15` : "transparent",
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.5,
                      display: "inline-block",
                      border: isPast ? `1px solid ${ACTION_COLORS[step.action]}30` : "1px solid transparent",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.55rem",
                        fontFamily: "monospace",
                        color: isPast ? "#f4f4f5" : "#52525b",
                        display: "block",
                        lineHeight: 1.3,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.label.length > 28 ? step.label.slice(0, 28) + "…" : step.label}
                    </Typography>
                  </Box>
                </foreignObject>
              </g>
            );
          })}

          <line
            x1={`${((currentTick - minTick) / range) * 100}%`}
            y1="0"
            x2={`${((currentTick - minTick) / range) * 100}%`}
            y2="36"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            opacity={0.6}
          />
        </svg>
      </Box>
    </Box>
  );
}
