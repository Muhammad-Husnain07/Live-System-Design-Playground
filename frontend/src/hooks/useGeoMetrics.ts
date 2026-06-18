import { useState, useEffect, useCallback, useRef } from "react";
import { fetchGeoMetrics } from "../services/geoMetrics";
import type { GeoMetricsResponse } from "../types/geo";

const POLL_INTERVAL = 3000;

export function useGeoMetrics(runId: string | null) {
  const [data, setData] = useState<GeoMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!runId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchGeoMetrics(runId);
      setData(result);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.error || err?.message || "Failed to fetch geo metrics");
      }
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  return { data, error, loading, refetch: poll };
}
