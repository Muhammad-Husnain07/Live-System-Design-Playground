import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Rocket, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from "lucide-react";
import { Box, Typography, Button, Select, MenuItem, Slider } from "@mui/material";
import { useSimulationStore } from "../../store/simulationStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useDeployStore } from "../../store/deploymentStore";
import { useToastStore } from "../../store/toastStore";
import api, { getErrorMessage } from "../../utils/api";

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
        const msg = getErrorMessage(err, "Failed to shift traffic.");
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
      const msg = getErrorMessage(err, "Promotion failed.");
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
      const msg = getErrorMessage(err, "Rollback failed.");
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
      const msg = getErrorMessage(err, "Failed to set group.");
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
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ px: '12px', py: '10px', borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Rocket size={16} />
          <Typography component="span" sx={{ fontSize: '12px', fontWeight: 600, color: 'text.primary' }}>Deployment</Typography>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: '12px' }}>
          <Typography sx={{ fontSize: '10px', textAlign: 'center', color: 'text.placeholder' }}>Start a simulation to control deployments</Typography>
        </Box>
      </Box>
    );
  }

  const activeGroup = depState?.activeGroup ?? deployCfg?.activeGroup ?? "";

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%' }}>
      <Box sx={{ px: '12px', py: '10px', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Rocket size={16} />
        <Typography component="span" sx={{ fontSize: '12px', fontWeight: 600, color: 'text.primary' }}>Deployment</Typography>
        {isBlueGreen && activeGroup && (
          <Typography
            component="span"
            sx={{
              ml: 'auto', fontSize: '9px', fontFamily: 'monospace', px: '6px', py: '2px', borderRadius: '999px',
              bgcolor: activeGroup === "blue" ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
              color: activeGroup === "blue" ? 'primary.main' : 'success.main',
            }}
          >
            {activeGroup}
          </Typography>
        )}
        {deployCfg?.isCanaryActive && (
          <Typography
            component="span"
            sx={{ ml: 'auto', fontSize: '9px', bgcolor: 'rgba(168,85,247,0.2)', px: '6px', py: '2px', borderRadius: '999px', fontFamily: 'monospace', color: 'secondary.main' }}
          >
            active
          </Typography>
        )}
      </Box>

      <Box sx={{
        flex: 1, overflowY: 'auto', p: '12px', '& > * + *': { mt: '16px' },
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'background.elevated', borderRadius: '3px' },
        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
      }}>
        <Box>
          <Typography component="label" sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, mb: '6px', display: 'block', color: 'text.secondary' }}>
            Deploy Node
          </Typography>
          {deployNodes.length === 0 ? (
            <Typography sx={{ fontSize: '10px', color: 'text.placeholder' }}>No nodes with canary or blue/green strategy configured</Typography>
          ) : (
            <Select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              size="small"
              sx={{
                width: '100%', bgcolor: 'background.elevated', fontSize: '11px', color: 'text.primary', borderRadius: '4px',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider', borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'secondary.main' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'secondary.main' },
                '& .MuiSelect-icon': { color: 'text.secondary' },
              }}
            >
              <MenuItem value="" sx={{ fontSize: '11px' }}>Select a node...</MenuItem>
              <MenuItem disabled sx={{ fontSize: '10px', color: 'text.secondary', opacity: '1 !important' }}>Blue/Green</MenuItem>
              {bgNodes.map((n) => (
                <MenuItem key={n.id} value={n.id} sx={{ fontSize: '11px' }}>
                  {n.data?.label ?? n.id}
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ fontSize: '10px', color: 'text.secondary', opacity: '1 !important' }}>Canary</MenuItem>
              {canaryNodes.map((n) => (
                <MenuItem key={n.id} value={n.id} sx={{ fontSize: '11px' }}>
                  {n.data?.label ?? n.id}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>

        {selectedNodeId && deployCfg && isBlueGreen && (
          <>
            <Box sx={{ bgcolor: 'background.paper', borderRadius: '8px', border: '1px solid', borderColor: 'divider', p: '12px', '& > * + *': { mt: '12px' } }}>
              <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, color: 'text.secondary' }}>
                Blue/Green Status
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' }}>
                    <Typography component="span" sx={{ fontSize: '10px', color: 'text.secondary' }}>Group assignment</Typography>
                    <Typography component="span" sx={{ fontSize: '11px', fontFamily: 'monospace', color: 'text.primary' }}>{depState?.blueGreenGroup || deployCfg?.blueGreenGroup || "—"}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: '4px' }}>
                    <Button
                      onClick={() => handleSetGroup("blue")}
                      disabled={shifting || depState?.blueGreenGroup === "blue"}
                      sx={{
                        flex: 1, py: '6px', fontSize: '10px', fontWeight: 500, borderRadius: '4px', textTransform: 'none', minWidth: 0,
                        bgcolor: depState?.blueGreenGroup === "blue" || deployCfg?.blueGreenGroup === "blue" ? 'rgba(99,102,241,0.3)' : 'background.elevated',
                        color: depState?.blueGreenGroup === "blue" || deployCfg?.blueGreenGroup === "blue" ? 'primary.light' : 'text.secondary',
                        '&:hover': { bgcolor: depState?.blueGreenGroup === "blue" || deployCfg?.blueGreenGroup === "blue" ? 'rgba(99,102,241,0.3)' : 'background.hover' },
                        '&.Mui-disabled': { opacity: 0.5 },
                      }}
                    >
                      Blue
                    </Button>
                    <Button
                      onClick={() => handleSetGroup("green")}
                      disabled={shifting || depState?.blueGreenGroup === "green"}
                      sx={{
                        flex: 1, py: '6px', fontSize: '10px', fontWeight: 500, borderRadius: '4px', textTransform: 'none', minWidth: 0,
                        bgcolor: depState?.blueGreenGroup === "green" || deployCfg?.blueGreenGroup === "green" ? 'rgba(34,197,94,0.3)' : 'background.elevated',
                        color: depState?.blueGreenGroup === "green" || deployCfg?.blueGreenGroup === "green" ? 'success.main' : 'text.secondary',
                        '&:hover': { bgcolor: depState?.blueGreenGroup === "green" || deployCfg?.blueGreenGroup === "green" ? 'rgba(34,197,94,0.3)' : 'background.hover' },
                        '&.Mui-disabled': { opacity: 0.5 },
                      }}
                    >
                      Green
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' }}>
                  <Typography component="span" sx={{ fontSize: '10px', color: 'text.secondary' }}>Active group</Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '11px', fontFamily: 'monospace', fontWeight: 500,
                      color: activeGroup === "blue" ? 'primary.main' : activeGroup === "green" ? 'success.main' : 'text.primary',
                    }}
                  >
                    {activeGroup || "blue (default)"}
                  </Typography>
                </Box>
                <Box sx={{ height: '8px', bgcolor: 'background.elevated', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                  <Box
                    sx={{
                      height: '100%', transition: 'all 0.3s',
                      bgcolor: activeGroup === "blue" ? 'primary.main' : 'success.main',
                      width: '100%',
                    }}
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Total RPS</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, fontVariantNumeric: 'tabular-nums', mt: '2px', color: 'text.primary' }}>
                  {Math.round(totalRPS).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Error Rate</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, fontVariantNumeric: 'tabular-nums', mt: '2px', color: errorRate > 0.1 ? 'error.main' : 'text.primary' }}>
                  {(errorRate * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Box>

            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              <Button
                onClick={handlePromote}
                disabled={shifting}
                sx={{
                  width: '100%', py: '8px', fontSize: '11px', fontWeight: 500, borderRadius: '4px', textTransform: 'none',
                  bgcolor: 'rgba(99,102,241,0.2)', color: 'primary.main',
                  '&:hover': { bgcolor: 'rgba(99,102,241,0.3)' },
                  '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
                }}
              >
                {shifting ? "Updating..." : <><ArrowUp size={12} /> Promote to {activeGroup === "blue" ? "Green" : "Blue"}</>}
              </Button>
              <Button
                onClick={handleRollback}
                disabled={shifting}
                sx={{
                  width: '100%', py: '8px', fontSize: '11px', fontWeight: 500, borderRadius: '4px', textTransform: 'none',
                  bgcolor: 'background.elevated', color: 'text.secondary',
                  '&:hover': { bgcolor: 'background.hover' },
                  '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
                }}
              >
                <RotateCcw size={12} /> Toggle (Rollback)
              </Button>
            </Box>
          </>
        )}

        {selectedNodeId && deployCfg && !isBlueGreen && (
          <>
            <Box sx={{ bgcolor: 'background.paper', borderRadius: '8px', border: '1px solid', borderColor: 'divider', p: '12px', '& > * + *': { mt: '8px' } }}>
              <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, color: 'text.secondary' }}>
                Traffic Split
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                <Typography component="span" sx={{ fontWeight: 500, color: 'primary.main' }}>Stable v1</Typography>
                <Typography component="span" sx={{ color: 'text.secondary' }}>{stablePct}%</Typography>
                <Typography component="span" sx={{ color: 'text.placeholder' }}>|</Typography>
                <Typography component="span" sx={{ fontWeight: 500, color: 'secondary.main' }}>Canary v2</Typography>
                <Typography component="span" sx={{ color: 'text.secondary' }}>{canaryPct}%</Typography>
              </Box>

                <Box sx={{ height: '10px', bgcolor: 'background.elevated', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                  <Box sx={{ height: '100%', bgcolor: 'primary.main', transition: 'all 0.3s', width: `${stablePct}%` }} />
                  <Box sx={{ height: '100%', bgcolor: 'secondary.main', transition: 'all 0.3s', width: `${canaryPct}%` }} />
              </Box>

              <Box sx={{ pt: '4px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' }}>
                  <Typography component="span" sx={{ fontSize: '9px', color: 'text.secondary' }}>Canary traffic</Typography>
                  <Typography component="span" sx={{ fontSize: '11px', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
                    {sliderValue}%
                  </Typography>
                </Box>
                <Slider
                  value={sliderValue}
                  onChange={(_, v) => handleSliderChange(v as number)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={shifting}
                  size="small"
                  sx={{ color: 'secondary.main', width: '100%', py: 0, '& .MuiSlider-thumb': { width: 12, height: 12 }, '& .MuiSlider-rail': { bgcolor: 'divider' } }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '2px' }}>
                  <Typography component="span" sx={{ fontSize: '8px', color: 'text.placeholder' }}>0% (stable)</Typography>
                  <Typography component="span" sx={{ fontSize: '8px', color: 'text.placeholder' }}>100% (canary)</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Stable RPS</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, fontVariantNumeric: 'tabular-nums', mt: '2px', color: 'primary.main' }}>
                  {Math.round(stableRPS).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Canary RPS</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, fontVariantNumeric: 'tabular-nums', mt: '2px', color: 'secondary.main' }}>
                  {Math.round(canaryRPS).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Error Rate</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, fontVariantNumeric: 'tabular-nums', mt: '2px', color: isFailing ? 'error.main' : (errorRate > 0.1 ? 'warning.main' : 'text.primary') }}>
                  {(errorRate * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: '8px' }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>Status</Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 500, mt: '2px' }}>
                  {deployCfg.isCanaryActive ? (
                    <Typography component="span" sx={{ color: 'secondary.main' }}>Canary active</Typography>
                  ) : deployCfg.canaryFailed ? (
                    <Typography component="span" sx={{ color: 'error.main' }}>Failed</Typography>
                  ) : (
                    <Typography component="span" sx={{ color: 'text.secondary' }}>Stable only</Typography>
                  )}
                </Typography>
              </Box>
            </Box>

            {isFailing && (
              <Box sx={{ bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', px: '12px', py: '8px', display: 'flex', alignItems: 'center', gap: 1 }}>
                <AlertTriangle size={16} />
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 500, color: 'error.main' }}>Canary degrading</Typography>
                  <Typography sx={{ fontSize: '9px', color: 'error.main', opacity: 0.7 }}>High error rate — auto-failover imminent</Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              <Button
                onClick={handlePromote}
                disabled={shifting || !deployCfg.isCanaryActive}
                sx={{
                  width: '100%', py: '8px', fontSize: '11px', fontWeight: 500, borderRadius: '4px', textTransform: 'none',
                  bgcolor: 'rgba(168,85,247,0.2)', color: 'secondary.main',
                  '&:hover': { bgcolor: 'rgba(168,85,247,0.3)' },
                  '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
                }}
              >
                {shifting ? "Updating..." : <><ArrowUp size={12} /> Promote Canary</>}
              </Button>
              <Button
                onClick={handleRollback}
                disabled={shifting}
                sx={{
                  width: '100%', py: '8px', fontSize: '11px', fontWeight: 500, borderRadius: '4px', textTransform: 'none',
                  bgcolor: 'rgba(239,68,68,0.2)', color: 'error.main',
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.3)' },
                  '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
                }}
              >
                <ArrowDown size={12} /> Rollback
              </Button>
            </Box>
          </>
        )}

        {!selectedNodeId && deployNodes.length > 0 && (
          <Box sx={{ py: '32px', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10px', color: 'text.placeholder' }}>Select a node above to control its deployment</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
