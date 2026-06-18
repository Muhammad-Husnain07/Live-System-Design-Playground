import api from "../utils/api";
import type { GeoMetricsResponse } from "../types/geo";

export async function fetchGeoMetrics(runId: string): Promise<GeoMetricsResponse> {
  const { data } = await api.get<GeoMetricsResponse>(`/simulations/${runId}/geo-metrics`);
  return data;
}
