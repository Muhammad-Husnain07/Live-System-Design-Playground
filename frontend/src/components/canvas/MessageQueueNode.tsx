import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Inbox, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";
import { Box, Stack, Typography, LinearProgress } from "@mui/material";

function MessageQueueNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const depth = data?.metrics?.queueDepth ?? 0;
  const maxDepth = 1000;
  const fillPct = Math.min((depth / maxDepth) * 100, 100);
  const barColor = fillPct > 80 ? "#EF4444" : fillPct > 50 ? "#F97316" : "#06B6D4";

  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "center", fontSize: 9, color: "#71717a" }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Inbox size={12} /> {props.data?.config?.instances ?? 3} brokers
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Zap size={12} /> {props.data?.config?.maxRPS ?? 0} max RPS
          </Typography>
        </Stack>
        <Box sx={{ mt: 0.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", fontSize: 8, color: "#71717a", mb: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: 8, color: "#71717a" }}>Queue depth</Typography>
            <Typography variant="caption" sx={{ fontSize: 8, fontFamily: "monospace", color: barColor }}>{depth.toLocaleString()}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={fillPct}
            sx={{
              height: 8, borderRadius: "999px", bgcolor: "#27272a",
              border: 1, borderColor: "#3f3f4680",
              "& .MuiLinearProgress-bar": {
                bgcolor: barColor, borderRadius: "999px",
                transition: "all 0.7s ease-out",
              },
            }}
          />
        </Box>
      </Box>
    </BaseNode>
  );
}

export default memo(MessageQueueNode);
