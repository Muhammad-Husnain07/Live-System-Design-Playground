import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, IconButton, Box, Typography, Popover, Chip, CircularProgress,
} from "@mui/material";
import { X, Globe, Activity } from "lucide-react";
import * as d3 from "d3";
import { useCanvasStore } from "../../store/canvasStore";
import { useSimulationStore } from "../../store/simulationStore";
import api from "../../utils/api";

/* ── AWS Region coordinates (lat, lon) ── */
const REGION_COORDS: Record<string, [number, number]> = {
  "us-east-1":      [38.0, -78.0],
  "us-west-2":      [45.5, -123.0],
  "eu-west-1":      [53.0, -7.0],
  "eu-central-1":   [50.0, 8.0],
  "ap-southeast-1": [1.3, 103.8],
  "ap-northeast-1": [35.0, 139.0],
  "ap-south-1":     [19.0, 73.0],
  "sa-east-1":      [-23.0, -46.0],
  "us-gov-west-1":  [38.5, -123.0],
  "ap-east-1":      [22.5, 114.0],
  "me-south-1":     [26.0, 50.0],
  "af-south-1":     [-26.0, 28.0],
};

const REGION_COLORS: Record<string, string> = {
  "us-east-1":      "#4f9cf7",
  "us-west-2":      "#60a5fa",
  "eu-west-1":      "#34d399",
  "eu-central-1":   "#10b981",
  "ap-southeast-1": "#f59e0b",
  "ap-northeast-1": "#f97316",
  "ap-south-1":     "#a78bfa",
  "sa-east-1":      "#ec4899",
};

/* ── Simplified continent outlines [lon, lat][] projected via d3.geoEquirectangular ── */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-130,50],[-120,55],[-100,60],[-80,65],[-60,55],[-55,50],[-65,45],[-75,35],[-80,25],[-85,20],[-90,15],[-100,15],[-105,20],[-110,25],[-115,30],[-120,35],[-125,40],[-130,45]],
  // South America
  [[-80,10],[-75,5],[-60,0],[-35,-5],[-35,-10],[-40,-15],[-45,-20],[-50,-25],[-55,-30],[-65,-35],[-70,-35],[-72,-30],[-70,-25],[-70,-15],[-75,-5],[-78,0]],
  // Europe
  [[-10,35],[-8,40],[0,43],[5,48],[10,55],[5,58],[0,60],[5,62],[10,65],[15,68],[25,70],[30,70],[35,60],[30,55],[25,50],[20,45],[15,40],[10,38],[5,36],[0,35]],
  // Africa
  [[-15,35],[-5,35],[10,37],[30,32],[40,12],[50,12],[50,5],[45,0],[40,-5],[35,-10],[30,-15],[30,-20],[25,-25],[20,-30],[15,-35],[10,-35],[10,-30],[8,-25],[5,-20],[0,-15],[-5,-10],[-10,-5],[-15,0],[-17,5],[-15,10],[-15,15],[-15,20],[-12,25],[-10,30]],
  // Asia
  [[30,70],[40,65],[50,60],[60,55],[70,50],[80,50],[90,50],[100,50],[110,50],[120,50],[130,48],[135,45],[140,40],[140,35],[135,35],[130,30],[125,25],[120,20],[115,15],[110,10],[105,10],[100,5],[100,0],[100,-5],[95,-8],[90,-5],[85,-5],[80,0],[75,5],[70,8],[65,10],[60,12],[55,15],[50,18],[45,20],[40,20],[35,15],[30,12],[28,10],[25,8],[20,8],[15,10],[10,15],[10,20],[15,25],[20,30],[25,35],[30,40],[35,45],[40,50],[40,55],[35,60],[30,65]],
  // Australia
  [[115,-25],[120,-20],[130,-15],[140,-15],[145,-18],[150,-20],[150,-25],[148,-30],[145,-35],[140,-38],[135,-38],[130,-35],[125,-33],[118,-32],[115,-30]],
  // Greenland
  [[-55,60],[-50,65],[-40,70],[-30,75],[-20,80],[-15,82],[-20,78],[-30,75],[-40,72],[-50,70],[-55,65]],
  // Antarctica (simplified tip)
  [[-60,-65],[-30,-70],[0,-70],[30,-70],[60,-68],[90,-68],[120,-68],[150,-66],[180,-66],[180,-70],[120,-72],[60,-72],[0,-72],[-60,-70],[-90,-68],[-120,-66],[-180,-65]],
];

interface RegionPopupData {
  region: string;
  anchorEl: HTMLElement;
  metrics: RegionMetrics;
}

interface RegionMetrics {
  nodeCount: number;
  totalRPS: number;
  avgLatencyMs: number;
  avgErrorRate: number;
  isFailed: boolean;
  failedNodeIds: string[];
  nodeIds: string[];
}

interface InterRegionEdge {
  sourceRegion: string;
  targetRegion: string;
  totalRPS: number;
  avgLatencyMs: number;
  edgeCount: number;
}

interface GeoMetricsResponse {
  regions: Record<string, RegionMetrics>;
  interRegionEdges: InterRegionEdge[];
}

/* ── Helpers ── */
const W = 1200, H = 700;
const projection = d3.geoEquirectangular().fitSize([W, H], { type: "Sphere" } as any);

function latLonToXY(lat: number, lon: number): [number, number] {
  const p = projection([lon, lat]);
  return p ? [p[0], p[1]] : [0, 0];
}

function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bulge = Math.max(dist * 0.3, 40);
  const cx = midX, cy = midY - bulge;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function latencyColor(ms: number): string {
  if (ms <= 0) return "#22c55e";
  if (ms <= 50) return "#22c55e";
  if (ms <= 150) return "#eab308";
  return "#ef4444";
}

function rpsToThickness(rps: number): number {
  if (rps <= 0) return 0.5;
  return Math.min(Math.max(Math.sqrt(rps) * 0.3, 0.5), 8);
}

export default function GlobalMapDialog({ open, onClose, runId }: { open: boolean; onClose: () => void; runId: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);

  const nodes = useCanvasStore((s) => s.nodes);
  const latestTick = useSimulationStore((s) => s.latestTick);

  const [geoData, setGeoData] = useState<GeoMetricsResponse | null>(null);
  const [popup, setPopup] = useState<RegionPopupData | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── Fetch geo-metrics ── */
  const fetchGeo = useCallback(async () => {
    if (!runId) return;
    try {
      setLoading(true);
      const res = await api.get<GeoMetricsResponse>(`/simulations/${runId}/geo-metrics`);
      setGeoData(res.data);
    } catch {
      // silently fail — will retry
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (open && runId) {
      fetchGeo();
      const iv = setInterval(fetchGeo, 3000);
      return () => clearInterval(iv);
    }
  }, [open, runId, fetchGeo]);

  /* ── Compute region metrics from latest tick (complementary to API data) ── */
  function computeRegionMetrics(): Record<string, RegionMetrics> {
    const regionMap: Record<string, { nodeIds: string[]; rps: number; lat: number; err: number; failed: string[] }> = {};

    for (const n of nodes) {
      const region = (n.data as any)?.config?.region || "us-east-1";
      if (!regionMap[region]) {
        regionMap[region] = { nodeIds: [], rps: 0, lat: 0, err: 0, failed: [] };
      }
      regionMap[region].nodeIds.push(n.id);
    }

    if (latestTick) {
      for (const m of latestTick.nodeMetrics) {
        const n = nodes.find((nd) => nd.id === m.nodeId);
        const region = (n?.data as any)?.config?.region || "us-east-1";
        if (!regionMap[region]) {
          regionMap[region] = { nodeIds: [], rps: 0, lat: 0, err: 0, failed: [] };
          regionMap[region].nodeIds.push(m.nodeId);
        }
        regionMap[region].rps += m.currentRPS || 0;
        regionMap[region].lat += m.p99LatencyMs || 0;
        regionMap[region].err += m.errorRate || 0;
        if (m.isFailed) regionMap[region].failed.push(m.nodeId);
      }
    }

    const result: Record<string, RegionMetrics> = {};
    for (const [region, d] of Object.entries(regionMap)) {
      const cnt = latestTick ? d.nodeIds.length : d.nodeIds.length;
      result[region] = {
        nodeCount: d.nodeIds.length,
        totalRPS: Math.round(d.rps * 100) / 100,
        avgLatencyMs: cnt > 0 ? Math.round((d.lat / cnt) * 100) / 100 : 0,
        avgErrorRate: cnt > 0 ? Math.round((d.err / cnt) * 10000) / 10000 : 0,
        isFailed: d.failed.length > 0,
        failedNodeIds: d.failed,
        nodeIds: d.nodeIds,
      };
    }
    return result;
  }

  const regionMetrics = computeRegionMetrics();

  /* ── Aggregate inter-region edges from canvas edges ── */
  function computeInterRegionEdges(): InterRegionEdge[] {
    const edgeAgg = new Map<string, { rps: number; lat: number; count: number }>();
    for (const e of nodes.flatMap((n) =>
      nodes
        .filter((t) => t.id !== n.id)
        .map((t) => ({ src: n, tgt: t })),
    )) {
      const srcRegion = (e.src.data as any)?.config?.region || "us-east-1";
      const tgtRegion = (e.tgt.data as any)?.config?.region || "us-east-1";
      if (srcRegion === tgtRegion) continue;

      // Find matching edge in canvas
      const canvasEdge = useCanvasStore.getState().edges.find(
        (ce) => ce.source === e.src.id && ce.target === e.tgt.id,
      );
      const rps = (canvasEdge?.data as any)?.throughputRPS || 0;
      const lat = (canvasEdge?.data as any)?.latencyMs || 0;
      const key = `${srcRegion}::${tgtRegion}`;
      const existing = edgeAgg.get(key) || { rps: 0, lat: 0, count: 0 };
      existing.rps += rps;
      existing.lat += lat;
      existing.count++;
      edgeAgg.set(key, existing);
    }

    return Array.from(edgeAgg.entries()).map(([key, d]) => {
      const [src, tgt] = key.split("::");
      return {
        sourceRegion: src,
        targetRegion: tgt,
        totalRPS: Math.round(d.rps * 100) / 100,
        avgLatencyMs: d.count > 0 ? Math.round((d.lat / d.count) * 100) / 100 : 0,
        edgeCount: d.count,
      };
    });
  }

  const interRegionEdges = computeInterRegionEdges();

  /* ── D3 rendering ── */
  useEffect(() => {
    if (!svgRef.current || !open) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // Background gradient
    defs.append("radialGradient").attr("id", "map-glow")
      .attr("cx", "50%").attr("cy", "50%").attr("r", "70%")
      .append("stop").attr("offset", "0%").attr("stop-color", "#1a1a2e")
      .append("stop").attr("offset", "100%").attr("stop-color", "#09090b");

    // Pulse filter for failed regions
    const filter = defs.append("filter").attr("id", "pulse-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    // Graticule
    const graticule = d3.geoGraticule().step([30, 30]);
    g.append("path")
      .datum(graticule() as any)
      .attr("d", d3.geoPath().projection(projection) as any)
      .attr("fill", "none")
      .attr("stroke", "#27272a")
      .attr("stroke-width", 0.5);

    // Continents
    g.selectAll(".continent")
      .data(CONTINENTS)
      .enter()
      .append("path")
      .attr("class", "continent")
      .attr("d", (d: any) => {
        const projected = d.map(([lon, lat]: number[]) => projection([lon, lat]));
        return projected ? `M${projected.map((p: [number, number]) => `${p[0]},${p[1]}`).join("L")}Z` : "";
      })
      .attr("fill", "#1e293b")
      .attr("stroke", "#334155")
      .attr("stroke-width", 0.8);

    // Cross-region arcs
    const arcGroup = g.append("g").attr("class", "arcs");
    for (const edge of interRegionEdges) {
      if (edge.totalRPS <= 0) continue;
      const srcCoord = REGION_COORDS[edge.sourceRegion];
      const tgtCoord = REGION_COORDS[edge.targetRegion];
      if (!srcCoord || !tgtCoord) continue;

      const [x1, y1] = latLonToXY(srcCoord[0], srcCoord[1]);
      const [x2, y2] = latLonToXY(tgtCoord[0], tgtCoord[1]);

      const isFailedRegion = regionMetrics[edge.sourceRegion]?.isFailed || regionMetrics[edge.targetRegion]?.isFailed;

      arcGroup.append("path")
        .attr("d", arcPath(x1, y1, x2, y2))
        .attr("fill", "none")
        .attr("stroke", latencyColor(edge.avgLatencyMs))
        .attr("stroke-width", rpsToThickness(edge.totalRPS))
        .attr("stroke-opacity", isFailedRegion ? 0.3 : 0.6)
        .attr("stroke-dasharray", isFailedRegion ? "4,4" : "none")
        .append("title")
        .text(`${edge.sourceRegion} → ${edge.targetRegion}\n${edge.totalRPS} RPS, ${edge.avgLatencyMs}ms`);
    }

    // Region dots
    const dotGroup = g.append("g").attr("class", "dots");
    for (const [region, coord] of Object.entries(REGION_COORDS)) {
      const metrics = regionMetrics[region];
      if (!metrics) continue;
      const [x, y] = latLonToXY(coord[0], coord[1]);
      const color = REGION_COLORS[region] || "#6b7280";
      const isFailed = metrics.isFailed;
      const dotRadius = Math.max(6, Math.min(16, Math.sqrt(metrics.totalRPS) * 0.5 + 4));

      const group = dotGroup.append("g")
        .attr("transform", `translate(${x},${y})`)
        .style("cursor", "pointer")
        .on("click", (event: MouseEvent) => {
          setPopup({
            region,
            anchorEl: event.currentTarget as HTMLElement,
            metrics,
          });
        });

      // Outer glow
      group.append("circle")
        .attr("r", dotRadius * 1.8)
        .attr("fill", isFailed ? "rgba(239,68,68,0.15)" : `${color}15`)
        .attr("stroke", "none");

      // Main dot
      group.append("circle")
        .attr("r", dotRadius)
        .attr("fill", isFailed ? "#ef4444" : color)
        .attr("stroke", "#09090b")
        .attr("stroke-width", 2)
        .attr("class", isFailed ? "region-failed" : "")
        .style("filter", isFailed ? "url(#pulse-glow)" : "none");

      // Failed overlay ring
      if (isFailed) {
        group.append("circle")
          .attr("r", dotRadius + 4)
          .attr("fill", "none")
          .attr("stroke", "#ef4444")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "3,3")
          .attr("opacity", 0.8)
          .append("animate")
          .attr("attributeName", "r")
          .attr("values", `${dotRadius + 2};${dotRadius + 8};${dotRadius + 2}`)
          .attr("dur", "1.5s")
          .attr("repeatCount", "indefinite");
      }

      // RPS label
      group.append("text")
        .attr("y", -dotRadius - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#a1a1aa")
        .attr("font-size", "9px")
        .attr("font-family", "monospace")
        .text(metrics.totalRPS > 0 ? `${Math.round(metrics.totalRPS)}` : "");

      // Region label
      group.append("text")
        .attr("y", dotRadius + 14)
        .attr("text-anchor", "middle")
        .attr("fill", isFailed ? "#ef4444" : "#a1a1aa")
        .attr("font-size", "10px")
        .attr("font-weight", isFailed ? "700" : "500")
        .attr("font-family", "monospace")
        .text(region);
    }

    // Fallback arcs for geo-metrics API data (overlay on top)
    if (geoData) {
      for (const edge of geoData.interRegionEdges) {
        if (edge.totalRPS <= 0) continue;
        const srcCoord = REGION_COORDS[edge.sourceRegion];
        const tgtCoord = REGION_COORDS[edge.targetRegion];
        if (!srcCoord || !tgtCoord) continue;
        const [x1, y1] = latLonToXY(srcCoord[0], srcCoord[1]);
        const [x2, y2] = latLonToXY(tgtCoord[0], tgtCoord[1]);
        // Only add if this edge wasn't already rendered from canvas data
        const existing = interRegionEdges.find(
          (e) => e.sourceRegion === edge.sourceRegion && e.targetRegion === edge.targetRegion,
        );
        if (existing) continue;

        const isFailed = geoData.regions[edge.sourceRegion]?.isFailed || geoData.regions[edge.targetRegion]?.isFailed;
        arcGroup.append("path")
          .attr("d", arcPath(x1, y1, x2, y2))
          .attr("fill", "none")
          .attr("stroke", latencyColor(edge.avgLatencyMs))
          .attr("stroke-width", rpsToThickness(edge.totalRPS))
          .attr("stroke-opacity", isFailed ? 0.15 : 0.3)
          .attr("stroke-dasharray", isFailed ? "3,3" : "none");
      }
    }

    // Animation loop for failover arc transitions
    let tick = 0;
    function animate() {
      tick++;
      arcGroup.selectAll("path").each(function () {
        const el = d3.select(this);
        const currentDash = el.attr("stroke-dasharray");
        if (currentDash && currentDash !== "none") {
          const offset = tick % 16;
          el.attr("stroke-dashoffset", String(offset));
        }
      });
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [open, regionMetrics, interRegionEdges, geoData]);

  return (
    <>
      <Dialog fullScreen open={open} onClose={onClose} slotProps={{ paper: { sx: { bgcolor: "#09090b" } } }}>
        <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Globe size={20} style={{ color: "#22c55e" }} />
              <Typography variant="subtitle2" sx={{ color: "#f4f4f5", fontWeight: 700 }}>Global Map</Typography>
              {loading && <CircularProgress size={14} sx={{ color: "#71717a" }} />}
            </Box>
            <IconButton size="small" onClick={onClose} sx={{ color: "#a1a1aa" }}><X size={18} /></IconButton>
          </Box>

          {/* Map container */}
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", p: 2 }}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "100%", borderRadius: 8, background: "transparent" }} />
          </Box>

          {/* Legend */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, px: 3, py: 1, borderTop: 1, borderColor: "divider", bgcolor: "background.default", flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 12, height: 3, borderRadius: 1, bgcolor: "#22c55e" }} />
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>{'<50ms'}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 12, height: 3, borderRadius: 1, bgcolor: "#eab308" }} />
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>50-150ms</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 12, height: 3, borderRadius: 1, bgcolor: "#ef4444" }} />
              <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>{'>150ms'}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ef4444", border: "2px solid #09090b" }} />
              <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.6rem", fontWeight: 600 }}>Region Down</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
              <Activity size={12} style={{ color: "#22c55e" }} />
              <Typography variant="caption" sx={{ color: "#22c55e", fontSize: "0.6rem" }}>Live</Typography>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Region Popover */}
      <Popover
        open={Boolean(popup)}
        anchorEl={popup?.anchorEl}
        onClose={() => setPopup(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{ paper: { sx: { bgcolor: "#18181b", border: "1px solid #27272a", borderRadius: 2, minWidth: 220 } } }}
      >
        {popup && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: REGION_COLORS[popup.region] || "#6b7280" }} />
              <Typography variant="subtitle2" sx={{ color: "#f4f4f5", fontWeight: 700, fontSize: "0.8rem" }}>{popup.region}</Typography>
              {popup.metrics.isFailed && (
                <Chip label="DOWN" size="small" sx={{ height: 18, fontSize: "0.55rem", bgcolor: "rgba(239,68,68,0.2)", color: "#ef4444", fontWeight: 700, ml: "auto" }} />
              )}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>Nodes</Typography>
                <Typography variant="body2" sx={{ color: "#f4f4f5", fontWeight: 600 }}>{popup.metrics.nodeCount}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>Total RPS</Typography>
                <Typography variant="body2" sx={{ color: "#f4f4f5", fontWeight: 600 }}>{Math.round(popup.metrics.totalRPS).toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>Avg Latency</Typography>
                <Typography variant="body2" sx={{ color: popup.metrics.avgLatencyMs > 150 ? "#ef4444" : popup.metrics.avgLatencyMs > 50 ? "#eab308" : "#22c55e", fontWeight: 600 }}>
                  {popup.metrics.avgLatencyMs.toFixed(1)}ms
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#71717a", fontSize: "0.6rem" }}>Error Rate</Typography>
                <Typography variant="body2" sx={{ color: popup.metrics.avgErrorRate > 0.05 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                  {(popup.metrics.avgErrorRate * 100).toFixed(2)}%
                </Typography>
              </Box>
            </Box>
            {popup.metrics.failedNodeIds.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.6rem", fontWeight: 600 }}>
                  Failed Nodes: {popup.metrics.failedNodeIds.join(", ")}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Popover>
    </>
  );
}
