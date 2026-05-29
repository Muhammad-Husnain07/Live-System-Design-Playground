import { useState, useCallback } from "react";
import { Zap, Play, Check, X } from "lucide-react";
import api from "../../utils/api";
import { Box, Typography, Button, TextField, MenuItem } from "@mui/material";

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
    <Box sx={{ width: 320, flexShrink: 0, bgcolor: '#09090b', borderLeft: 1, borderColor: '#27272a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: '#27272a', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Zap style={{ width: 16, height: 16, color: '#ef4444' }} />
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5' }}>DR Drill</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ px: 1.5, py: 1 }}>
          <Box sx={{ '& > :not(:last-child)': { mb: 1.5 } }}>
            <Typography sx={{ fontSize: '10px', lineHeight: 1.625, color: '#71717a' }}>
              Test your architecture against real-world failure scenarios. Select a scenario and run the drill.
            </Typography>

            <Box>
              <Box sx={{ '& > :not(:last-child)': { mb: 0.75 } }}>
                <Typography sx={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, color: '#71717a' }}>
                  Scenario
                </Typography>
                <TextField
                  select
                  value={scenario}
                  onChange={(e) => { setScenario(e.target.value); setResult(null); }}
                  disabled={running}
                  size="small"
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#27272a',
                      fontSize: '11px',
                      color: '#f4f4f5',
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3f3f46' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#3f3f46' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  {SCENARIOS.map((s) => (
                    <MenuItem key={s.value} value={s.value} sx={{ fontSize: '11px' }}>{s.label}</MenuItem>
                  ))}
                </TextField>
                <Typography sx={{ fontSize: '10px', color: '#71717a' }}>
                  {SCENARIOS.find((s) => s.value === scenario)?.desc}
                </Typography>
              </Box>
            </Box>

            <Button
              onClick={handleStart}
              disabled={running || !projectIdFromUrl}
              fullWidth
              sx={{
                py: 1,
                fontSize: 12,
                fontWeight: 500,
                bgcolor: 'rgba(239,68,68,0.2)',
                color: '#ef4444',
                borderRadius: '4px',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.3)' },
                '&.Mui-disabled': { opacity: 0.5 },
                textTransform: 'none',
              }}
            >
              {running ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 12,
                      height: 12,
                      border: '1px solid',
                      borderColor: '#f87171',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                  <Typography component="span" sx={{ fontSize: 12, color: '#ef4444' }}>Running Drill...</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Play style={{ width: 12, height: 12 }} />
                  <Typography component="span" sx={{ fontSize: 12, color: '#ef4444' }}>Start Drill</Typography>
                </Box>
              )}
            </Button>

            {error && (
              <Box sx={{ p: 1, bgcolor: 'rgba(239,68,68,0.1)', border: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '10px' }}>
                {error}
              </Box>
            )}

            {result && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '8px',
                  border: 1,
                  fontSize: 12,
                  bgcolor: result.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  borderColor: result.passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {result.passed ? <Check style={{ width: 20, height: 20, color: '#22c55e' }} /> : <X style={{ width: 20, height: 20, color: '#ef4444' }} />}
                  <Typography sx={{ fontWeight: 600, color: result.passed ? '#22c55e' : '#ef4444', fontSize: 12 }}>
                    {result.passed ? "PASSED" : "FAILED"}
                  </Typography>
                </Box>
                <Box sx={{ '& > :not(:last-child)': { mb: 0.5 }, fontSize: '10px', color: '#a1a1aa' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography component="span" sx={{ fontSize: '10px', color: '#a1a1aa' }}>Max Error Rate</Typography>
                    <Typography component="span" sx={{ fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa' }}>{(result.maxErrorRate * 100).toFixed(1)}%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography component="span" sx={{ fontSize: '10px', color: '#a1a1aa' }}>Duration</Typography>
                    <Typography component="span" sx={{ fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa' }}>{result.durationTicks} ticks</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography component="span" sx={{ fontSize: '10px', color: '#a1a1aa' }}>Injected At</Typography>
                    <Typography component="span" sx={{ fontSize: '10px', fontFamily: 'monospace', color: '#a1a1aa' }}>tick {result.injectedAt}</Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {!projectIdFromUrl && (
              <Typography sx={{ fontSize: '10px', textAlign: 'center', color: '#52525b' }}>
                Load a project to run drills.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
