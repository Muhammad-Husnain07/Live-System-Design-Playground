import { useRef, useEffect, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import * as d3 from "d3";
import { useGeoMetrics } from "../../hooks/useGeoMetrics";
import { REGION_COORDS, getLatencyColor, type InterRegionEdge } from "../../types/geo";
import { spatialTokens } from "../../theme/spatialTokens";
import type { GeoMetricsResponse, RegionMetrics } from "../../types/geo";

interface GlobalMapDialogProps {
  open: boolean;
  onClose: () => void;
  runId: string | null;
}

const MAP_WIDTH = 960;
const MAP_HEIGHT = 540;

function geoPath(d: [number, number][]): string {
  return d.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
}

function buildArc(
  projection: d3.GeoEquirectangularProjection,
  srcRegion: string,
  tgtRegion: string,
): string | null {
  const src = REGION_COORDS[srcRegion];
  const tgt = REGION_COORDS[tgtRegion];
  if (!src || !tgt) return null;
  const srcPx = projection([src.lng, src.lat]);
  const tgtPx = projection([tgt.lng, tgt.lat]);
  if (!srcPx || !tgtPx) return null;
  const [x1, y1] = srcPx;
  const [x2, y2] = tgtPx;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bulge = Math.max(dist * 0.25, 30);
  const cx = midX + bulge * (dy / dist);
  const cy = midY - bulge * (dx / dist);
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function renderMap(
  svgEl: SVGSVGElement,
  data: GeoMetricsResponse,
) {
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();

  const projection = d3.geoEquirectangular()
    .fitSize([MAP_WIDTH, MAP_HEIGHT], { type: "Sphere" } as any);

  // Graticule (grid lines)
  const graticule = d3.geoGraticule();
  svg.append("path")
    .datum(graticule() as any)
    .attr("d", d3.geoPath(projection) as any)
    .attr("fill", "none")
    .attr("stroke", "rgba(255,255,255,0.04)")
    .attr("stroke-width", 0.5);

  // Equator highlight
  svg.append("path")
    .datum({ type: "LineString", coordinates: [[-180, 0], [180, 0]] } as any)
    .attr("d", d3.geoPath(projection) as any)
    .attr("fill", "none")
    .attr("stroke", "rgba(99,102,241,0.15)")
    .attr("stroke-width", 1);

  // Compute max RPS for scaling
  const allRPS = Object.values(data.regions).map((r: RegionMetrics) => r.totalRPS);
  const maxRPS = Math.max(...allRPS, 1);
  const maxRadius = 28;
  const minRadius = 6;

  // Cross-region arcs
  const arcsGroup = svg.append("g").attr("class", "arcs");
  for (const edge of data.interRegionEdges) {
    const pathD = buildArc(projection, edge.sourceRegion, edge.targetRegion);
    if (!pathD) continue;
    const isFailed = data.regions[edge.sourceRegion]?.isFailed || data.regions[edge.targetRegion]?.isFailed;
    const color = getLatencyColor(edge.avgLatencyMs);
    arcsGroup.append("path")
      .attr("d", pathD)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", Math.max(1, Math.min(4, edge.totalRPS / (maxRPS || 1) * 4)))
      .attr("stroke-dasharray", isFailed ? "6,4" : "none")
      .attr("opacity", 0.5);
    // Arrow dot at midpoint
    const mid = pathD.match(/Q([\d.]+),([\d.]+)/);
    if (mid) {
      const mx = parseFloat(mid[1]);
      const my = parseFloat(mid[2]);
      arcsGroup.append("circle")
        .attr("cx", mx)
        .attr("cy", my)
        .attr("r", 2.5)
        .attr("fill", color)
        .attr("opacity", 0.7);
    }
  }

  // Region dots
  const dotsGroup = svg.append("g").attr("class", "dots");
  for (const [region, metrics] of Object.entries(data.regions) as [string, RegionMetrics][]) {
    const coords = REGION_COORDS[region];
    if (!coords) continue;
    const px = projection([coords.lng, coords.lat]);
    if (!px) continue;
    const [cx, cy] = px;
    const radius = Math.max(minRadius, Math.sqrt(metrics.totalRPS / maxRPS) * maxRadius);
    const color = getLatencyColor(metrics.avgLatencyMs);

    // Glow
    dotsGroup.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", radius * 1.8)
      .attr("fill", color)
      .attr("opacity", 0.08);

    // Main dot
    dotsGroup.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", radius)
      .attr("fill", color)
      .attr("opacity", 0.9)
      .attr("stroke", "rgba(0,0,0,0.4)")
      .attr("stroke-width", 1);

    // RPS label
    dotsGroup.append("text")
      .attr("x", cx)
      .attr("y", cy + radius + 14)
      .attr("text-anchor", "middle")
      .attr("fill", spatialTokens.text.secondary)
      .attr("font-size", "9px")
      .attr("font-family", spatialTokens.font.mono)
      .text(`${Math.round(metrics.totalRPS)} rps`);

    // Region label
    dotsGroup.append("text")
      .attr("x", cx)
      .attr("y", cy - radius - 6)
      .attr("text-anchor", "middle")
      .attr("fill", spatialTokens.text.primary)
      .attr("font-size", "10px")
      .attr("font-family", spatialTokens.font.ui)
      .attr("font-weight", 500)
      .text(coords.label.replace(/\(.*\)/, "").trim());

    // Latency label
    dotsGroup.append("text")
      .attr("x", cx)
      .attr("y", cy - radius - 6 + 13)
      .attr("text-anchor", "middle")
      .attr("fill", color)
      .attr("font-size", "9px")
      .attr("font-family", spatialTokens.font.mono)
      .text(`${Math.round(metrics.avgLatencyMs)}ms`);

    // Failed region — pulsing ring (2 rings)
    if (metrics.isFailed) {
      const pulseR = radius + 8;
      for (let i = 0; i < 2; i++) {
        dotsGroup.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", pulseR + i * 6)
          .attr("fill", "none")
          .attr("stroke", spatialTokens.accent.error)
          .attr("stroke-width", 2)
          .attr("opacity", 0.7 - i * 0.2)
          .append("animate")
          .attr("attributeName", "r")
          .attr("values", `${pulseR};${pulseR + 20};${pulseR}`)
          .attr("dur", "2s")
          .attr("repeatCount", "indefinite");
        dotsGroup.select(`circle:last-child`)
          .append("animate")
          .attr("attributeName", "opacity")
          .attr("values", "0.7;0;0.7")
          .attr("dur", "2s")
          .attr("repeatCount", "indefinite");
      }
    }
  }
}

export default function GlobalMapDialog({ open, onClose, runId }: GlobalMapDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { data, error, loading } = useGeoMetrics(runId);

  useEffect(() => {
    if (data && svgRef.current && open) {
      renderMap(svgRef.current, data);
    }
  }, [data, open]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      sx={{
        "& .MuiDialog-paper": {
          bgcolor: spatialTokens.bg.void,
          border: `1px solid ${spatialTokens.border.default}`,
          borderRadius: "12px",
          boxShadow: spatialTokens.shadow.island,
          maxWidth: MAP_WIDTH + 80,
          width: "90vw",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 3, py: 2 }}>
        <Box>
          <Typography sx={{ color: spatialTokens.text.primary, fontSize: "14px", fontWeight: 600, fontFamily: spatialTokens.font.ui }}>
            Global Traffic Map
          </Typography>
          <Typography sx={{ color: spatialTokens.text.secondary, fontSize: "11px", fontFamily: spatialTokens.font.ui }}>
            Cross-region latency &amp; traffic flow
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: spatialTokens.text.secondary }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3, overflow: "hidden" }}>
        {loading && !data && (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: MAP_HEIGHT }}>
            <CircularProgress size={28} sx={{ color: spatialTokens.accent.primary }} />
          </Box>
        )}
        {error && !data && (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: MAP_HEIGHT }}>
            <Typography sx={{ color: spatialTokens.accent.error, fontSize: "12px", fontFamily: spatialTokens.font.ui }}>
              {error}
            </Typography>
          </Box>
        )}
        {!loading && !error && !data && (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: MAP_HEIGHT }}>
            <Typography sx={{ color: spatialTokens.text.secondary, fontSize: "12px", fontFamily: spatialTokens.font.ui }}>
              No geo-metrics available. Run a simulation first.
            </Typography>
          </Box>
        )}
        {data && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
