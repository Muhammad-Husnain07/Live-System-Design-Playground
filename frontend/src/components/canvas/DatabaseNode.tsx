import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Database, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";
import { Box, Stack, Typography } from "@mui/material";

function DatabaseNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5 }}>
        <svg width="100%" height="24" viewBox="0 0 180 24" style={{ overflow: "visible" }}>
          <ellipse cx="90" cy="4" rx="80" ry="4" fill="none" stroke="#52525b" strokeWidth="1.5" />
          <path d="M10 4 L10 20" stroke="#52525b" strokeWidth="1.5" />
          <path d="M170 4 L170 20" stroke="#52525b" strokeWidth="1.5" />
          <ellipse cx="90" cy="20" rx="80" ry="4" fill="none" stroke="#52525b" strokeWidth="1.5" />
          <ellipse cx="90" cy="12" rx="80" ry="4" fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 3" />
          <ellipse cx="90" cy="4" rx="80" ry="4" fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.3" />
        </svg>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", fontSize: 9, color: "#71717a", justifyContent: "center" }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Database size={12} /> {props.data?.config?.instances ?? 1} replicas
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Zap size={12} /> {props.data?.config?.maxRPS ?? 0} max RPS
          </Typography>
        </Stack>
      </Box>
    </BaseNode>
  );
}

export default memo(DatabaseNode);
