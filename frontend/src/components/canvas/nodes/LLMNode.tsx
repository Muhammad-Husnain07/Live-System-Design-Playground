import { memo, useMemo } from "react";
import { type NodeProps } from "reactflow";
import { BrainCircuit, Zap } from "lucide-react";
import BaseNode from "../BaseNode";
import type { BaseNodeData } from "../BaseNode";
import { Box, Stack, Typography } from "@mui/material";

const BLOCK_COUNT = 6;
const BLOCK_COLORS = ["#a855f7", "#c084fc", "#a78bfa", "#7c3aed", "#8b5cf6", "#a855f7"];

function LLMNode(props: NodeProps<BaseNodeData>) {
  const isProcessing = (props.data?.metrics?.currentRPS ?? 0) > 0;

  const blocks = useMemo(
    () =>
      Array.from({ length: BLOCK_COUNT }, (_, i) => {
        const delay = 0.2 + i * 0.35;
        const xStart = -10 - i * 16;
        const xEnd = 190 + i * 12;
        return { id: i, delay, xStart, xEnd, color: BLOCK_COLORS[i % BLOCK_COLORS.length], size: 6 + (i % 3) * 2 };
      }),
    [],
  );

  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5, position: "relative", height: 40, overflow: "hidden" }}>
        <svg width="100%" height="40" viewBox="0 0 180 40" style={{ overflow: "visible" }}>
          <rect x="2" y="4" width="176" height="22" rx="4" fill="none" stroke="#3f3f46" strokeWidth="1" />
          <rect x="4" y="6" width="172" height="18" rx="3" fill="rgba(168,85,247,0.06)" />

          {isProcessing
            ? blocks.map((b) => (
                <rect
                  key={b.id}
                  x={b.xStart}
                  y={8 + (b.id % 3) * 5}
                  width={b.size}
                  height={b.size}
                  rx={1.5}
                  fill={b.color}
                  opacity={0.7}
                >
                  <animate
                    attributeName="x"
                    values={`${b.xStart}; ${b.xEnd}`}
                    dur={`${1.2 + (b.id % 3) * 0.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.7; 0.3; 0.7"
                    dur={`0.8s`}
                    begin={`${b.delay}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))
            : null}

          {!isProcessing && (
            <text x="90" y="18" textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">
              idle
            </text>
          )}
        </svg>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", fontSize: 9, color: "#71717a", justifyContent: "center" }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <BrainCircuit size={12} /> {props.data?.config?.tokensPerSecond ?? 0} TPS
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Zap size={12} /> {props.data?.metrics?.currentRPS?.toFixed(0) ?? 0} RPS
          </Typography>
        </Stack>
      </Box>
    </BaseNode>
  );
}

export default memo(LLMNode);
