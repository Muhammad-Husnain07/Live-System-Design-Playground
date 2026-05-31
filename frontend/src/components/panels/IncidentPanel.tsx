import { AlertTriangle, BugPlay } from "lucide-react";
import { Box, Typography, Select, MenuItem, Button, Paper, Chip, Divider } from "@mui/material";
import { useIncidentStore, INCIDENT_SCENARIOS } from "../../store/incidentStore";
import { useSimulationStore } from "../../store/simulationStore";
import EmptyState from "../ui/EmptyState";

export default function IncidentPanel() {
  const { activeScenario, setActiveScenario, triggerIncident, triggering, postMortem } = useIncidentStore();
  const runId = useSimulationStore((s) => s.runId);
  const isRunning = useSimulationStore((s) => s.isRunning);

  const canTrigger = !!runId && isRunning && !!activeScenario;

  const handleTrigger = async () => {
    if (!runId || !activeScenario) return;
    await triggerIncident(runId);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <BugPlay size={16} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#f4f4f5", fontSize: "0.75rem" }}>Incident Replay</Typography>
      </Box>

      <Box sx={{ px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#52525b", display: "block", mb: 0.5 }}>
            Scenario
          </Typography>
          <Select
            value={activeScenario?.id ?? ""}
            onChange={(e) => {
              const sc = INCIDENT_SCENARIOS.find((s) => s.id === e.target.value) ?? null;
              setActiveScenario(sc);
            }}
            size="small"
            displayEmpty
            fullWidth
            sx={{ fontSize: "0.7rem", bgcolor: "background.elevated", color: "#f4f4f5", "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" } }}
          >
            <MenuItem value="" disabled sx={{ fontSize: "0.7rem" }}>Select a scenario...</MenuItem>
            {INCIDENT_SCENARIOS.map((sc) => (
              <MenuItem key={sc.id} value={sc.id} sx={{ fontSize: "0.7rem" }}>{sc.name}</MenuItem>
            ))}
          </Select>
        </Box>

        {activeScenario && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#a1a1aa", lineHeight: 1.5, display: "block" }}>
              {activeScenario.description}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
              <Chip label={activeScenario.industry} size="small" sx={{ fontSize: "0.6rem", height: 20, bgcolor: `${activeScenario.color}20`, color: activeScenario.color }} />
              <Chip label={`${activeScenario.steps.length} steps`} size="small" sx={{ fontSize: "0.6rem", height: 20, bgcolor: "rgba(255,255,255,0.04)", color: "#a1a1aa" }} />
            </Box>
          </Paper>
        )}

        <Button
          onClick={handleTrigger}
          disabled={!canTrigger || triggering}
          variant="contained"
          size="small"
          fullWidth
          startIcon={<AlertTriangle size={14} />}
          sx={{ bgcolor: "rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.7rem", "&:hover": { bgcolor: "rgba(239,68,68,0.3)" }, "&.Mui-disabled": { opacity: 0.3, color: "#ef4444" } }}
        >
          {triggering ? "Triggering..." : "Trigger Incident"}
        </Button>

        {!runId && (
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#52525b", textAlign: "center" }}>
            Start a simulation first
          </Typography>
        )}
        {runId && !isRunning && (
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#52525b", textAlign: "center" }}>
            Simulation must be running
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: "divider" }} />

      {postMortem && (
        <Box sx={{ px: 1.5, py: 1.5, overflow: "auto" }}>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500, color: "#52525b", display: "block", mb: 1.5 }}>
            Post-Mortem — {postMortem.scenarioName}
          </Typography>

          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper", borderColor: "divider", mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#ef4444", fontWeight: 600, display: "block", mb: 0.25 }}>
              Root Cause
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "#f4f4f5" }}>{postMortem.rootCause}</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper", borderColor: "divider", mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fb923c", fontWeight: 600, display: "block", mb: 0.5 }}>
              Blast Radius ({postMortem.blastRadius.length})
            </Typography>
            {postMortem.blastRadius.length === 0 ? (
              <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#71717a" }}>No nodes degraded</Typography>
            ) : (
              postMortem.blastRadius.map((b, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.25 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: b.issue === "Failed" ? "#ef4444" : "#fb923c", flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#a1a1aa" }}>{b.nodeLabel}</Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#71717a", ml: "auto", flexShrink: 0 }}>{b.issue}</Typography>
                </Box>
              ))
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper", borderColor: "#22c55e40" }}>
            <Typography variant="caption" sx={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#22c55e", fontWeight: 600, display: "block", mb: 0.25 }}>
              Resolution Suggestion
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#a1a1aa", lineHeight: 1.5, display: "block" }}>
              {postMortem.resolutionSuggestion}
            </Typography>
          </Paper>
        </Box>
      )}

      {!postMortem && activeScenario && (
        <Box sx={{ px: 1.5, py: 1.5 }}>
          <EmptyState icon="activity" title="No post-mortem yet" description="Run the simulation with an active incident to generate a post-mortem analysis." />
        </Box>
      )}
    </Box>
  );
}
