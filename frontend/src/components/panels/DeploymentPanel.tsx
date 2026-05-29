import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Rocket, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from "lucide-react";
import { useSimulationStore } from "../../store/simulationStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useDeployStore } from "../../store/deploymentStore";
import { useToastStore } from "../../store/toastStore";
import api from "../../utils/api";

export default function DeploymentPanel() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const runId = useSimulationStore((s) => s.runId);
  const latestTick = useSimulationStore((s) => s.latestTick);
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeStates = useDeployStore((s) => s.nodeStates);
  const setNodeState = useDeployStore((s) => s.setNodeState);
  const addToast = useToastStore((s) => s.addToast);

  const bgNodes = useMemo(
    () => nodes.filter((n) => n.data?.config?.deployment?.strategy === "blue_green"),
    [nodes],
  );
  const canaryNodes = useMemo(
    () => nodes.filter((n) => n.data?.config?.deployment?.strategy === "canary"),
    [nodes],
  );
  const deployNodes = useMemo(() => [...bgNodes, ...canaryNodes], [bgNodes, canaryNodes]);

  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const [shifting, setShifting] = useState(false);
  const promoteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const deployCfg = selectedNode?.data?.config?.deployment;
  const metrics = selectedNode?.data?.metrics;
  const isBlueGreen = deployCfg?.strategy === "blue_green";
  const depState = nodeStates[selectedNodeId ?? ""];

  const tickMetrics = useMemo(() => {
    if (!latestTick || !selectedNodeId) return null;
    return latestTick.nodeMetrics.find((m) => m.nodeId === selectedNodeId) ?? null;
  }, [latestTick, selectedNodeId]);

  const totalRPS = tickMetrics?.currentRPS ?? metrics?.currentRPS ?? 0;
  const canaryRPS = tickMetrics?.canaryRPS ?? metrics?.canaryRPS ?? 0;
  const stableRPS = Math.max(0, totalRPS - canaryRPS);
  const canaryPct = totalRPS > 0 ? Math.round((canaryRPS / totalRPS) * 100) : 0;
  const stablePct = 100 - canaryPct;

  const errorRate = tickMetrics?.errorRate ?? metrics?.errorRate ?? 0;
  const isFailing = deployCfg?.isCanaryActive && errorRate > 0.3;

  useEffect(() => {
    if (selectedNodeId && deployCfg) {
      setSliderValue(Math.round(deployCfg.canaryPercent));
    }
  }, [selectedNodeId, deployCfg?.canaryPercent]);

  const doShift = useCallback(
    async (percent: number) => {
      if (!runId || !selectedNodeId) return;
      setShifting(true);
      try {
        await api.post(`/simulations/${runId}/deployment/shift`, {
          nodeId: selectedNodeId,
          canaryPercent: percent,
        });
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? "Failed to shift traffic";
        addToast({ type: "error", title: "Shift failed", message: msg, duration: 5000 });
      } finally {
        setShifting(false);
      }
    },
    [runId, selectedNodeId, addToast],
  );

  const debouncedShift = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSliderChange = useCallback(
    (value: number) => {
      setSliderValue(value);
      if (debouncedShift.current) clearTimeout(debouncedShift.current);
      debouncedShift.current = setTimeout(() => doShift(value), 200);
    },
    [doShift],
  );

  const handlePromote = useCallback(async () => {
    if (!runId || !selectedNodeId) return;
    setShifting(true);
    try {
      if (isBlueGreen) {
        const resp = await api.post(`/simulations/${runId}/deployment/promote`, {
          nodeId: selectedNodeId,
        });
        const newGroup = resp.data.activeGroup as string;
        setNodeState(selectedNodeId, { activeGroup: newGroup });
        addToast({
          type: "success",
          title: "Blue/Green promoted",
          message: `Active group switched to ${newGroup}`,
          duration: 4000,
        });
      } else {
        await api.post(`/simulations/${runId}/deployment/failover`, {
          nodeId: selectedNodeId,
          direction: "canary",
        });
        setSliderValue(100);
        addToast({
          type: "success",
          title: "Canary promoted",
          message: "All traffic shifted to canary v2",
          duration: 4000,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Promotion failed";
      addToast({ type: "error", title: "Promotion failed", message: msg, duration: 5000 });
    } finally {
      setShifting(false);
    }
  }, [runId, selectedNodeId, isBlueGreen, setNodeState, addToast]);

  const handleRollback = useCallback(async () => {
    if (!runId || !selectedNodeId) return;
    setShifting(true);
    try {
      if (isBlueGreen) {
        const resp = await api.post(`/simulations/${runId}/deployment/promote`, {
          nodeId: selectedNodeId,
        });
        const newGroup = resp.data.activeGroup as string;
        setNodeState(selectedNodeId, { activeGroup: newGroup });
        addToast({
          type: "info",
          title: "Blue/Green rollback",
          message: `Rolled back to ${newGroup}`,
          duration: 4000,
        });
      } else {
        await api.post(`/simulations/${runId}/deployment/failover`, {
          nodeId: selectedNodeId,
          direction: "stable",
        });
        setSliderValue(0);
        addToast({
          type: "info",
          title: "Rolled back",
          message: "All traffic shifted back to stable v1",
          duration: 4000,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Rollback failed";
      addToast({ type: "error", title: "Rollback failed", message: msg, duration: 5000 });
    } finally {
      setShifting(false);
    }
  }, [runId, selectedNodeId, isBlueGreen, setNodeState, addToast]);

  const handleSetGroup = useCallback(async (group: string) => {
    if (!runId || !selectedNodeId) return;
    setShifting(true);
    try {
      await api.post(`/simulations/${runId}/deployment/set-group`, {
        nodeId: selectedNodeId,
        group,
      });
      setNodeState(selectedNodeId, { blueGreenGroup: group });
      addToast({
        type: "success",
        title: "Group set",
        message: `Node assigned to ${group} group`,
        duration: 3000,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to set group";
      addToast({ type: "error", title: "Set group failed", message: msg, duration: 5000 });
    } finally {
      setShifting(false);
    }
  }, [runId, selectedNodeId, setNodeState, addToast]);

  useEffect(() => {
    return () => {
      if (debouncedShift.current) clearTimeout(debouncedShift.current);
      if (promoteRef.current) clearTimeout(promoteRef.current);
    };
  }, []);

  if (!isRunning) {
    return (
      <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col">
        <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          <span className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>Deployment</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-3">
          <p className="text-[10px] text-center" style={{ color: '#52525b' }}>Start a simulation to control deployments</p>
        </div>
      </div>
    );
  }

  const activeGroup = depState?.activeGroup ?? deployCfg?.activeGroup ?? "";

  return (
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
        <Rocket className="h-4 w-4" />
        <span className="text-xs font-semibold" style={{ color: '#f4f4f5' }}>Deployment</span>
        {isBlueGreen && activeGroup && (
          <span
            className={`ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
              activeGroup === "blue" ? "bg-blue-500/20" : "bg-green-500/20"
            }`}
            style={{ color: activeGroup === "blue" ? '#60a5fa' : '#22c55e' }}
          >
            {activeGroup}
          </span>
        )}
        {deployCfg?.isCanaryActive && (
          <span className="ml-auto text-[9px] bg-purple-500/20 px-1.5 py-0.5 rounded-full font-mono" style={{ color: '#a78bfa' }}>
            active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800 p-3 space-y-4">
        {/* Node selector */}
        <div>
          <label className="text-[9px] uppercase tracking-wider font-medium mb-1.5 block" style={{ color: '#71717a' }}>
            Deploy Node
          </label>
          {deployNodes.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#52525b' }}>No nodes with canary or blue/green strategy configured</p>
          ) : (
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full bg-surface-800 text-[11px] px-2 py-1.5 rounded border border-surface-700 focus:outline-none focus:border-purple-500"
              style={{ color: '#f4f4f5' }}
            >
              <option value="">Select a node...</option>
              <optgroup label="Blue/Green">
                {bgNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label ?? n.id}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Canary">
                {canaryNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label ?? n.id}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </div>

        {selectedNodeId && deployCfg && isBlueGreen && (
          <>
            {/* Blue/Green status */}
            <div className="bg-surface-900 rounded-lg border border-surface-800 p-3 space-y-3">
              <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: '#71717a' }}>Blue/Green Status</p>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]" style={{ color: '#a1a1aa' }}>Group assignment</span>
                    <span className="text-[11px] font-mono" style={{ color: '#f4f4f5' }}>{depState?.blueGreenGroup || deployCfg?.blueGreenGroup || "—"}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSetGroup("blue")}
                      disabled={shifting || depState?.blueGreenGroup === "blue"}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-colors ${
                        depState?.blueGreenGroup === "blue" || deployCfg?.blueGreenGroup === "blue"
                          ? "bg-blue-500/30"
                          : "bg-surface-800 hover:bg-surface-700"
                      } disabled:opacity-50`}
                      style={{
                        color: depState?.blueGreenGroup === "blue" || deployCfg?.blueGreenGroup === "blue"
                          ? '#93c5fd'
                          : '#a1a1aa'
                      }}
                    >
                      Blue
                    </button>
                    <button
                      onClick={() => handleSetGroup("green")}
                      disabled={shifting || depState?.blueGreenGroup === "green"}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded transition-colors ${
                        depState?.blueGreenGroup === "green" || deployCfg?.blueGreenGroup === "green"
                          ? "bg-green-500/30"
                          : "bg-surface-800 hover:bg-surface-700"
                      } disabled:opacity-50`}
                      style={{
                        color: depState?.blueGreenGroup === "green" || deployCfg?.blueGreenGroup === "green"
                          ? '#86efac'
                          : '#a1a1aa'
                      }}
                    >
                      Green
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: '#a1a1aa' }}>Active group</span>
                  <span
                    className="text-[11px] font-mono font-medium"
                    style={{
                      color: activeGroup === "blue" ? '#60a5fa' : activeGroup === "green" ? '#22c55e' : '#f4f4f5'
                    }}
                  >
                    {activeGroup || "blue (default)"}
                  </span>
                </div>
                <div className="h-2 bg-surface-800 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${activeGroup === "blue" ? "bg-blue-500" : "bg-green-500"}`}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Total RPS</div>
                <div className="text-xs font-mono font-medium tabular-nums mt-0.5" style={{ color: '#f4f4f5' }}>
                  {Math.round(totalRPS).toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Error Rate</div>
                <div
                  className="text-xs font-mono font-medium tabular-nums mt-0.5"
                  style={{ color: errorRate > 0.1 ? '#ef4444' : '#f4f4f5' }}
                >
                  {(errorRate * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1.5">
              <button
                onClick={handlePromote}
                disabled={shifting}
                className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: '#60a5fa' }}
              >
                {shifting ? "Updating..." : <><ArrowUp className="h-3 w-3" /> Promote to {activeGroup === "blue" ? "Green" : "Blue"}</>}
              </button>
              <button
                onClick={handleRollback}
                disabled={shifting}
                className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-surface-800 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: '#a1a1aa' }}
              >
                <RotateCcw className="h-3 w-3" /> Toggle (Rollback)
              </button>
            </div>
          </>
        )}

        {selectedNodeId && deployCfg && !isBlueGreen && (
          <>
            {/* Traffic split visual */}
            <div className="bg-surface-900 rounded-lg border border-surface-800 p-3 space-y-2">
              <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: '#71717a' }}>
                Traffic Split
              </p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="font-medium" style={{ color: '#60a5fa' }}>Stable v1</span>
                <span style={{ color: '#a1a1aa' }}>{stablePct}%</span>
                <span style={{ color: '#52525b' }}>|</span>
                <span className="font-medium" style={{ color: '#a78bfa' }}>Canary v2</span>
                <span style={{ color: '#a1a1aa' }}>{canaryPct}%</span>
              </div>

              <div className="h-2.5 bg-surface-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${stablePct}%` }}
                />
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${canaryPct}%` }}
                />
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px]" style={{ color: '#71717a' }}>Canary traffic</span>
                  <span className="text-[11px] font-mono tabular-nums" style={{ color: '#f4f4f5' }}>
                    {sliderValue}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={sliderValue}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  disabled={shifting}
                  className="w-full accent-purple-500 h-1.5"
                />
                <div className="flex justify-between text-[8px] mt-0.5" style={{ color: '#52525b' }}>
                  <span>0% (stable)</span>
                  <span>100% (canary)</span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Stable RPS</div>
                <div className="text-xs font-mono font-medium tabular-nums mt-0.5" style={{ color: '#60a5fa' }}>
                  {Math.round(stableRPS).toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Canary RPS</div>
                <div className="text-xs font-mono font-medium tabular-nums mt-0.5" style={{ color: '#a78bfa' }}>
                  {Math.round(canaryRPS).toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Error Rate</div>
                <div
                  className="text-xs font-mono font-medium tabular-nums mt-0.5" style={{ color: !isFailing && errorRate > 0.1 ? '#fb923c' : 'inherit' }}
                  style={{ color: isFailing ? '#ef4444' : (errorRate > 0.1 ? undefined : '#f4f4f5') }}
                >
                  {(errorRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-surface-900 rounded border border-surface-800 p-2">
                <div className="text-[9px] uppercase tracking-wider" style={{ color: '#71717a' }}>Status</div>
                <div className="text-xs font-mono font-medium mt-0.5">
                  {deployCfg.isCanaryActive ? (
                    <span style={{ color: '#a78bfa' }}>Canary active</span>
                  ) : deployCfg.canaryFailed ? (
                    <span style={{ color: '#ef4444' }}>Failed</span>
                  ) : (
                    <span style={{ color: '#a1a1aa' }}>Stable only</span>
                  )}
                </div>
              </div>
            </div>

            {isFailing && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: '#ef4444' }}>Canary degrading</p>
                  <p className="text-[9px]" style={{ color: '#ef4444', opacity: 0.7 }}>High error rate — auto-failover imminent</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <button
                onClick={handlePromote}
                disabled={shifting || !deployCfg.isCanaryActive}
                className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: '#a78bfa' }}
              >
                {shifting ? "Updating..." : <><ArrowUp className="h-3 w-3" /> Promote Canary</>}
              </button>
              <button
                onClick={handleRollback}
                disabled={shifting}
                className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: '#ef4444' }}
              >
                <ArrowDown className="h-3 w-3" /> Rollback
              </button>
            </div>
          </>
        )}

        {!selectedNodeId && deployNodes.length > 0 && (
          <div className="py-8 text-center">
            <p className="text-[10px]" style={{ color: '#52525b' }}>Select a node above to control its deployment</p>
          </div>
        )}
      </div>
    </div>
  );
}
