import { memo } from "react";
import { type NodeProps } from "reactflow";
import { DatabaseSearch, Layers } from "lucide-react";
import BaseNode from "../BaseNode";
import type { BaseNodeData } from "../BaseNode";
import { Box, Stack, Typography } from "@mui/material";

function VectorDBNode(props: NodeProps<BaseNodeData>) {
  const dims = props.data?.config?.dimensions ?? 1536;
  const topK = props.data?.config?.topK ?? 10;
  const indexType = props.data?.config?.indexType ?? "hnsw";

  return (
    <BaseNode {...props}>
      <Box sx={{ mt: 0.5, position: "relative", height: 44, overflow: "hidden" }}>
        <svg width="100%" height="44" viewBox="0 0 180 44" style={{ overflow: "visible" }}>
          <defs>
            <pattern id="vecgrid" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth="0.5" />
            </pattern>
            <pattern id="vecgrid-dense" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="none" stroke="rgba(139,92,246,0.05)" strokeWidth="0.3" />
            </pattern>
          </defs>

          <rect x="2" y="2" width="176" height="32" rx="4" fill="url(#vecgrid)" stroke="rgba(139,92,246,0.15)" strokeWidth="1" />
          <rect x="2" y="2" width="176" height="32" rx="4" fill="url(#vecgrid-dense)" />

          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => {
              const cx = 14 + col * 21;
              const cy = 10 + row * 6;
              const brightness = 0.15 + 0.35 * Math.random();
              return (
                <circle
                  key={`${row}-${col}`}
                  cx={cx}
                  cy={cy}
                  r={1 + Math.random() * 1.5}
                  fill={`rgba(139,92,246,${brightness})`}
                />
              );
            }),
          )}

          <text x="90" y="46" textAnchor="middle" fill="#71717a" fontSize="7" fontFamily="monospace">
            {dims.toLocaleString()}d · Top-{topK} · {indexType.toUpperCase()}
          </text>
        </svg>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", fontSize: 9, color: "#71717a", justifyContent: "center", mt: 1 }}>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <DatabaseSearch size={12} /> {dims.toLocaleString()} dims
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: "#71717a", display: "flex", alignItems: "center", gap: 0.25 }}>
            <Layers size={12} /> Top-{topK}
          </Typography>
        </Stack>
      </Box>
    </BaseNode>
  );
}

export default memo(VectorDBNode);
