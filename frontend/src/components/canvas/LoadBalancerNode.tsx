import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Scale, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";
import { Box, Stack, Typography } from "@mui/material";

function LoadBalancerNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5 }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: "center", justifyContent: "center", py: 0.5 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" opacity={0.6}>
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <rect x="14" y="2" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <rect x="8" y="14" width="8" height="8" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
            <line x1="6" y1="10" x2="10" y2="14" stroke="#52525b" strokeWidth="1" />
            <line x1="18" y1="10" x2="14" y2="14" stroke="#52525b" strokeWidth="1" />
          </svg>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "center", fontSize: 9, color: "#71717a" }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Scale size={12} /> {props.data?.config?.instances ?? 2} nodes
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Zap size={12} /> {props.data?.config?.maxRPS ?? 0} max RPS
          </Typography>
        </Stack>
      </Box>
    </BaseNode>
  );
}

export default memo(LoadBalancerNode);
