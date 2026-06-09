import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Check, Hourglass, XCircle } from "lucide-react";
import BaseNode from "../BaseNode";
import type { BaseNodeData } from "../BaseNode";
import { Box, Typography } from "@mui/material";

function OrchestratorNode(props: NodeProps<BaseNodeData>) {
  const config = props.data?.config ?? {};
  const metrics = props.data?.metrics;
  const isSimulating = (metrics?.currentRPS ?? 0) > 0;

  const failureMode = (config as any).failureMode ?? "compensate";
  const activeWorkflows = metrics?.activeWorkflows ?? 0;
  const failedWorkflows = metrics?.failedWorkflows ?? 0;
  const compensationEvents = metrics?.compensationEvents ?? 0;

  const activityLabels = ["Payment", "Inventory", "Shipping"];

  const stateIcons = [Check, Hourglass, Hourglass];

  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5, px: 0.5 }}>
        <Box
          sx={{
            bgcolor: "rgba(245,158,11,0.08)",
            borderRadius: 1,
            border: "1px solid rgba(245,158,11,0.2)",
            p: 0.75,
          }}
        >
          {activityLabels.map((label, i) => {
            const Icon = stateIcons[i % stateIcons.length];
            const color = isSimulating ? (i === 0 ? "#22c55e" : "#f59e0b") : "#71717a";
            return (
              <Box
                key={label}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.75, py: 0.25,
                  opacity: isSimulating ? 1 : 0.5,
                }}
              >
                <Icon size={10} color={color} />
                <Typography
                  sx={{
                    fontSize: "0.6rem", color,
                    fontFamily: "monospace", fontWeight: 500,
                    textTransform: "uppercase", letterSpacing: "0.03em",
                  }}
                >
                  {label}
                  {isSimulating && (
                    <Typography
                      component="span"
                      sx={{ fontSize: "0.55rem", color: "#52525b", ml: 0.5 }}
                    >
                      {i === 0 ? " ✓" : " ⏳"}
                    </Typography>
                  )}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "flex", justifyContent: "space-between", mt: 0.5,
            fontSize: "0.55rem", color: "#52525b", fontFamily: "monospace",
          }}
        >
          <span>Mode: {failureMode}</span>
          {isSimulating && activeWorkflows > 0 && (
            <span>{activeWorkflows} active · {failedWorkflows} failed</span>
          )}
        </Box>

        {compensationEvents > 0 && (
          <Box
            sx={{
              mt: 0.5, bgcolor: "rgba(239,68,68,0.1)", borderRadius: "4px",
              border: "1px solid rgba(239,68,68,0.25)", px: 0.5, py: 0.25,
              display: "flex", alignItems: "center", gap: 0.5,
            }}
          >
            <XCircle size={10} color="#ef4444" />
            <Typography sx={{ fontSize: "0.55rem", color: "#ef4444", fontFamily: "monospace" }}>
              {compensationEvents} compensation{compensationEvents !== 1 ? "s" : ""}
            </Typography>
          </Box>
        )}
      </Box>
    </BaseNode>
  );
}

export default memo(OrchestratorNode);
