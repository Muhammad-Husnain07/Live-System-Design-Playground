import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress, Paper } from "@mui/material";
import { useSLOStore } from "../../store/sloStore";

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function ms(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

function burnRateLabel(v: number): string {
  if (v >= 14.4) return `${v.toFixed(1)}x (Fast)`;
  if (v >= 1) return `${v.toFixed(1)}x (Slow)`;
  return `${v.toFixed(1)}x`;
}

export default function SLOPanel() {
  const sloReport = useSLOStore((s) => s.sloReport);
  const loading = useSLOStore((s) => s.loading);

  if (loading && !sloReport) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>Loading SLO data…</Typography>
      </Box>
    );
  }

  if (!sloReport || sloReport.nodes.length === 0) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>No SLO data — start a simulation</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
      <Typography variant="caption" sx={{ fontSize: "0.55rem", color: "#52525b", display: "block", mb: 1 }}>
        Window: {sloReport.windowSeconds}s
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "transparent", borderColor: "divider" }}>
        <Table size="small" sx={{ minWidth: 500 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "#71717a", fontSize: "0.55rem", fontWeight: 600, borderColor: "divider", py: 0.75 }}>Service</TableCell>
              <TableCell sx={{ color: "#71717a", fontSize: "0.55rem", fontWeight: 600, borderColor: "divider", py: 0.75 }}>SLO Target</TableCell>
              <TableCell sx={{ color: "#71717a", fontSize: "0.55rem", fontWeight: 600, borderColor: "divider", py: 0.75 }}>Actual</TableCell>
              <TableCell sx={{ color: "#71717a", fontSize: "0.55rem", fontWeight: 600, borderColor: "divider", py: 0.75 }}>Error Budget Remaining</TableCell>
              <TableCell sx={{ color: "#71717a", fontSize: "0.55rem", fontWeight: 600, borderColor: "divider", py: 0.75 }}>Burn Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sloReport.nodes.map((node) => {
              const budgetPct = Math.max(0, Math.min(100, node.availabilityBudgetRemainingPercent));
              const rowColor = node.status === "fast_burn" ? "rgba(239,68,68,0.08)" : node.status === "slow_burn" ? "rgba(250,204,21,0.08)" : "transparent";
              const textColor = node.status === "fast_burn" ? "#ef4444" : node.status === "slow_burn" ? "#facc15" : "#22c55e";
              const barColor = node.status === "fast_burn" ? "#ef4444" : node.status === "slow_burn" ? "#facc15" : "#22c55e";
              return (
                <TableRow
                  key={node.nodeId}
                  sx={{ bgcolor: rowColor, "&:hover": { bgcolor: "rgba(255,255,255,0.02)" } }}
                >
                  <TableCell sx={{ color: "#f4f4f5", fontSize: "0.6rem", borderColor: "divider", py: 0.75 }}>
                    {node.label}
                  </TableCell>
                  <TableCell sx={{ color: "#a1a1aa", fontSize: "0.55rem", borderColor: "divider", py: 0.75, fontFamily: "monospace" }}>
                    {pct(node.sloAvailabilityTarget)}
                    {node.sloTargetMs > 0 && ` / ${ms(node.sloTargetMs)}`}
                  </TableCell>
                  <TableCell sx={{ color: textColor, fontSize: "0.55rem", borderColor: "divider", py: 0.75, fontFamily: "monospace" }}>
                    {pct(1 - node.actualErrorRate)}
                    {node.sloTargetMs > 0 && ` / ${ms(node.actualLatencyMs)}`}
                  </TableCell>
                  <TableCell sx={{ borderColor: "divider", py: 0.75 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={budgetPct}
                        sx={{
                          flex: 1, height: 8, borderRadius: "999px", bgcolor: "#3f3f46",
                          "& .MuiLinearProgress-bar": { bgcolor: barColor, borderRadius: "999px" },
                        }}
                      />
                      <Typography variant="caption" sx={{ fontSize: "0.5rem", fontFamily: "monospace", color: textColor, flexShrink: 0, minWidth: 32, textAlign: "right" }}>
                        {budgetPct.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: textColor, fontSize: "0.55rem", borderColor: "divider", py: 0.75, fontFamily: "monospace" }}>
                    {burnRateLabel(node.burnRate)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
