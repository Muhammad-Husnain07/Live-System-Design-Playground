import { Skeleton, Box } from "@mui/material";

const shimmerSx = {
  borderRadius: 1,
  bgcolor: "#27272a",
  backgroundImage: "linear-gradient(90deg, #27272a 0%, #3f3f46 40%, #27272a 80%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
};

export function SkeletonLine({ width = "100%", height = 12 }: { width?: string; height?: number }) {
  return <Skeleton variant="rectangular" width={width} height={height} sx={shimmerSx} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Box sx={{ bgcolor: "#18181b", border: 1, borderColor: "#27272a", borderRadius: 1, p: 2 }}>
      <Skeleton variant="rectangular" width="70%" height={16} sx={{ ...shimmerSx, mb: 1 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" width={`${60 + Math.random() * 30}%`} height={10} sx={{ ...shimmerSx, mb: 0.5 }} />
      ))}
    </Box>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <Box key={r} sx={{ display: "flex", gap: 2 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} variant="rectangular" width={`${100 / cols}%`} height={12} sx={shimmerSx} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function SkeletonPanel() {
  return (
    <Box sx={{ width: 320, flexShrink: 0, bgcolor: "#09090b", borderLeft: 1, borderColor: "#27272a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "#27272a" }}>
        <Skeleton variant="rectangular" width="40%" height={14} sx={shimmerSx} />
      </Box>
      <Box sx={{ flex: 1, p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Skeleton variant="rectangular" width="100%" height={32} sx={shimmerSx} />
        <Skeleton variant="rectangular" width="100%" height={80} sx={shimmerSx} />
        <Skeleton variant="rectangular" width="60%" height={32} sx={shimmerSx} />
      </Box>
    </Box>
  );
}
