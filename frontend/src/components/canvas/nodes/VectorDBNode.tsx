import { memo, useMemo } from "react";
import { type NodeProps } from "reactflow";
import { DatabaseSearch, Layers } from "lucide-react";
import BaseNode from "../BaseNode";
import type { BaseNodeData } from "../BaseNode";
import { Box, Stack, Typography } from "@mui/material";

const DOT_ROWS = 5;
const DOT_COLS = 8;
const ROW_HEIGHTS = [10, 16, 22, 28, 34];
const COL_OFFSETS = [14, 35, 56, 77, 98, 119, 140, 161];
const DOT_SEED = [
  [0.35, 0.22, 0.41, 0.18, 0.38, 0.28, 0.15, 0.42],
  [0.20, 0.45, 0.12, 0.30, 0.48, 0.10, 0.33, 0.25],
  [0.40, 0.15, 0.38, 0.48, 0.22, 0.35, 0.18, 0.42],
  [0.25, 0.42, 0.10, 0.35, 0.15, 0.40, 0.30, 0.20],
  [0.38, 0.12, 0.45, 0.22, 0.35, 0.18, 0.28, 0.40],
];
const RADIUS_SEED = [
  [1.5, 1.0, 2.0, 1.2, 1.8, 1.0, 1.5, 2.0],
  [1.0, 2.0, 1.2, 1.5, 2.5, 1.0, 2.0, 1.2],
  [2.0, 1.5, 2.0, 2.5, 1.0, 2.0, 1.2, 2.0],
  [1.2, 2.0, 1.0, 2.0, 1.5, 2.0, 1.0, 1.5],
  [2.0, 1.0, 2.5, 1.5, 2.0, 1.2, 1.5, 2.5],
];

function VectorDBNode(props: NodeProps<BaseNodeData>) {
  const dims = props.data?.config?.dimensions ?? 1536;
  const topK = props.data?.config?.topK ?? 10;
  const indexType = props.data?.config?.indexType ?? "hnsw";

  const dots = useMemo(() => {
    const result: { cx: number; cy: number; r: number; brightness: number; row: number; col: number }[] = [];
    for (let row = 0; row < DOT_ROWS; row++) {
      for (let col = 0; col < DOT_COLS; col++) {
        result.push({
          cx: COL_OFFSETS[col % COL_OFFSETS.length],
          cy: ROW_HEIGHTS[row % ROW_HEIGHTS.length],
          r: RADIUS_SEED[row][col] ?? 1.5,
          brightness: DOT_SEED[row][col] ?? 0.3,
          row,
          col,
        });
      }
    }
    return result;
  }, []);

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

          {dots.map((d) => (
            <circle key={`${d.row}-${d.col}`} cx={d.cx} cy={d.cy} r={d.r} fill={`rgba(139,92,246,${d.brightness})`} />
          ))}

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
