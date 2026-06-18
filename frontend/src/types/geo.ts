export interface RegionMetrics {
  nodeCount: number;
  totalRPS: number;
  avgLatencyMs: number;
  avgErrorRate: number;
  nodeIds: string[];
  isFailed: boolean;
  failedNodeIds: string[];
}

export interface InterRegionEdge {
  sourceRegion: string;
  targetRegion: string;
  totalRPS: number;
  avgLatencyMs: number;
  edgeCount: number;
}

export interface GeoMetricsResponse {
  regions: Record<string, RegionMetrics>;
  interRegionEdges: InterRegionEdge[];
}

export interface RegionCoordinates {
  lat: number;
  lng: number;
  label: string;
}

export const REGION_COORDS: Record<string, RegionCoordinates> = {
  "us-east-1":      { lat: 38.9072, lng: -77.0369,   label: "us-east-1 (N. Virginia)" },
  "us-west-2":      { lat: 44.9429, lng: -123.0351,  label: "us-west-2 (Oregon)" },
  "eu-west-1":      { lat: 53.3498, lng: -6.2603,    label: "eu-west-1 (Ireland)" },
  "eu-central-1":   { lat: 50.1109, lng: 8.6821,     label: "eu-central-1 (Frankfurt)" },
  "ap-southeast-1": { lat: 1.3521,  lng: 103.8198,   label: "ap-southeast-1 (Singapore)" },
  "ap-northeast-1": { lat: 35.6762, lng: 139.6503,   label: "ap-northeast-1 (Tokyo)" },
  "ap-south-1":     { lat: 19.0760, lng: 72.8777,    label: "ap-south-1 (Mumbai)" },
  "sa-east-1":      { lat: -23.5505,lng: -46.6333,   label: "sa-east-1 (São Paulo)" },
};

export function getLatencyColor(latencyMs: number): string {
  if (latencyMs < 50) return "#22C55E";
  if (latencyMs < 150) return "#F59E0B";
  return "#EF4444";
}
