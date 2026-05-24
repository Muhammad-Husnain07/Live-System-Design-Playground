import { useState, useCallback } from "react";
import { Zap, Play, Check, X } from "lucide-react";
import api from "../../utils/api";

const SCENARIOS = [
  { value: "region_down", label: "Region Down", desc: "Simulates a complete cloud region failure" },
  { value: "ddos", label: "DDoS Attack", desc: "Simulates a distributed denial-of-service attack" },
  { value: "db_failure", label: "DB Failure", desc: "Simulates a primary database node failure" },
];

interface DrillResult {
  simulationRunId: string;
  scenario: string;
  passed: boolean;
  maxErrorRate: number;
  injectedAt: number;
  durationTicks: number;
}

export default function DrillPanel() {
  const [scenario, setScenario] = useState(SCENARIOS[0].value);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectIdFromUrl = window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null;

  const handleStart = useCallback(async () => {
    if (!projectIdFromUrl) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const { data } = await api.post(`/challenges/placeholder/drill`, {
        projectId: projectIdFromUrl,
        scenario,
      });
      setResult(data as DrillResult);
    } catch (err: any) {
      setError(err.response?.data?.error || "Drill failed");
    } finally {
      setRunning(false);
    }
  }, [scenario, projectIdFromUrl]);

  return (
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
        <Zap className="h-4 w-4 text-red-400" />
        <span className="text-xs font-semibold text-surface-100">DR Drill</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        <div className="px-3 py-2 space-y-3">
          <p className="text-[10px] text-surface-500 leading-relaxed">
            Test your architecture against real-world failure scenarios. Select a scenario and run the drill.
          </p>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-surface-500 font-medium">Scenario</label>
            <select
              value={scenario}
              onChange={(e) => { setScenario(e.target.value); setResult(null); }}
              disabled={running}
              className="w-full bg-surface-800 text-surface-200 text-[11px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              {SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-surface-500">
              {SCENARIOS.find((s) => s.value === scenario)?.desc}
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={running || !projectIdFromUrl}
            className="w-full py-2 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors disabled:opacity-50"
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-3 w-3 border border-red-400 border-t-transparent rounded-full" />
                Running Drill...
              </span>
            ) : (
              <><Play className="h-3 w-3" /> Start Drill</>
            )}
          </button>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg border text-xs ${result.passed ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.passed ? <Check className="h-5 w-5 text-green-400" /> : <X className="h-5 w-5 text-red-400" />}
                <span className={`font-semibold ${result.passed ? "text-green-400" : "text-red-400"}`}>
                  {result.passed ? "PASSED" : "FAILED"}
                </span>
              </div>
              <div className="space-y-1 text-[10px] text-surface-400">
                <div className="flex justify-between">
                  <span>Max Error Rate</span>
                  <span className="font-mono">{(result.maxErrorRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="font-mono">{result.durationTicks} ticks</span>
                </div>
                <div className="flex justify-between">
                  <span>Injected At</span>
                  <span className="font-mono">tick {result.injectedAt}</span>
                </div>
              </div>
            </div>
          )}

          {!projectIdFromUrl && (
            <p className="text-[10px] text-surface-600 text-center">Load a project to run drills.</p>
          )}
        </div>
      </div>
    </div>
  );
}
