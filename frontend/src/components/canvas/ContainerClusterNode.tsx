import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Container, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";
import { Box, Stack, Typography } from "@mui/material";

const TOTAL_PODS = 12;

function ContainerClusterNode(props: NodeProps<BaseNodeData>) {
  const { data } = props;
  const running = data?.config?.instances ?? 3;
  const healthyCount = Math.min(running, TOTAL_PODS);

  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5 }}>
        <Box
          sx={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.25, py: 0.25,
            justifyItems: "center",
          }}
        >
          {Array.from({ length: TOTAL_PODS }).map((_, i) => {
            const isHealthy = i < healthyCount;
            return (
              <Box
                key={i}
                sx={{
                  width: 16, height: 16, borderRadius: "2px", border: 1,
                  transition: "all 0.3s",
                  bgcolor: isHealthy ? "rgba(34,197,94,0.2)" : "rgba(39,39,42,0.5)",
                  borderColor: isHealthy ? "rgba(34,197,94,0.5)" : "rgba(63,63,70,0.5)",
                  boxShadow: isHealthy ? "inset 0 0 6px rgba(34,197,94,0.15)" : "none",
                }}
                title={isHealthy ? `Pod ${i + 1}: Running` : `Pod ${i + 1}: Idle`}
              />
            );
          })}
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "center", fontSize: 9, color: "#71717a" }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Container size={12} /> {healthyCount}/{TOTAL_PODS} pods
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Zap size={12} /> {props.data?.config?.maxRPS ?? 0} max RPS
          </Typography>
        </Stack>
      </Box>
    </BaseNode>
  );
}

export default memo(ContainerClusterNode);
