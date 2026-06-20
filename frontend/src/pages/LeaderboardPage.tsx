import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, Award, ArrowLeft } from "lucide-react";
import { useChallengeStore } from "../store/challengeStore";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  IconButton,
  TableContainer,
  Paper,
  Button,
} from "@mui/material";

import { useShallow } from "zustand/react/shallow";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { leaderboard, leaderboardLoading, leaderboardError, fetchLeaderboard } = useChallengeStore(useShallow((s) => ({ leaderboard: s.leaderboard, leaderboardLoading: s.leaderboardLoading, leaderboardError: s.leaderboardError, fetchLeaderboard: s.fetchLeaderboard })));

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#18181b', display: 'flex', flexDirection: 'column', color: '#f4f4f5' }}>
      <Box
        component="header"
        sx={{
          height: 52,
          flexShrink: 0,
          bgcolor: '#18181b',
          borderBottom: 1,
          borderColor: '#3f3f46',
          display: 'flex',
          alignItems: 'center',
          px: 3,
          gap: 1.5,
        }}
      >
        <IconButton
          onClick={() => navigate("/dashboard")}
          size="small"
          sx={{ color: '#a1a1aa' }}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Leaderboard</Typography>
      </Box>

      <Box component="main" sx={{ flex: 1, p: 3, maxWidth: 768, mx: 'auto', width: '100%' }}>
        {leaderboardError && !leaderboardLoading && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid', borderColor: 'rgba(239,68,68,0.2)', borderRadius: 1, fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{leaderboardError}</span>
            <Button onClick={fetchLeaderboard} size="small" sx={{ fontSize: '11px', color: '#60a5fa', minWidth: 0, ml: 2 }}>
              Retry
            </Button>
          </Box>
        )}
        {leaderboardLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 20 }}>
            <CircularProgress size={32} sx={{ color: '#3b82f6' }} />
          </Box>
        ) : leaderboard.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 20 }}>
            <Typography sx={{ color: '#71717a', fontSize: '0.75rem' }}>No submissions yet. Complete a challenge to appear here!</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ bgcolor: '#27272a', border: 1, borderColor: '#3f3f46', borderRadius: 2, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: 1, borderColor: '#3f3f46' }}>
                  <TableCell sx={{ color: '#71717a', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', px: 2, py: 1.25, width: 48 }}>Rank</TableCell>
                  <TableCell sx={{ color: '#71717a', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', px: 2, py: 1.25 }}>Username</TableCell>
                  <TableCell sx={{ color: '#71717a', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', px: 2, py: 1.25, width: 80, textAlign: 'right' }}>Score</TableCell>
                  <TableCell sx={{ color: '#71717a', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', px: 2, py: 1.25, width: 64, textAlign: 'right' }}>Status</TableCell>
                  <TableCell sx={{ color: '#71717a', fontSize: '0.625rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', px: 2, py: 1.25, width: 112, textAlign: 'right' }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow
                    key={`${entry.rank}-${entry.username}`}
                    sx={{
                      borderBottom: 1,
                      borderColor: 'rgba(39,39,42,0.5)',
                      '&:last-child td, &:last-child th': { border: 0 },
                      '&:hover': { bgcolor: 'rgba(39,39,42,0.3)' },
                    }}
                  >
                    <TableCell sx={{ px: 2, py: 1.25 }}>
                      {entry.rank === 1 ? (
                        <Trophy size={20} style={{ color: '#facc15' }} />
                      ) : entry.rank === 2 ? (
                        <Medal size={20} style={{ color: '#a1a1aa' }} />
                      ) : entry.rank === 3 ? (
                        <Award size={20} style={{ color: '#b45309' }} />
                      ) : (
                        <Typography sx={{ fontFamily: 'monospace', color: '#71717a' }}>{entry.rank}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.25, fontWeight: 500, color: '#f4f4f5' }}>{entry.username}</TableCell>
                    <TableCell sx={{ px: 2, py: 1.25, textAlign: 'right', fontFamily: 'monospace', color: '#f4f4f5' }}>{entry.score.toFixed(1)}</TableCell>
                    <TableCell sx={{ px: 2, py: 1.25, textAlign: 'right' }}>
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: '4px',
                          bgcolor: entry.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: entry.passed ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {entry.passed ? "PASS" : "FAIL"}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.25, textAlign: 'right', color: '#71717a' }}>
                      {new Date(entry.submittedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}
