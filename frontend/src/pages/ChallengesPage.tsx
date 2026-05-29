import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import { useChallengeStore, type Challenge } from "../store/challengeStore";
import { Box, Typography, Button, CircularProgress, Grid } from "@mui/material";

const DIFFICULTY_SX: Record<string, object> = {
  easy: { bgcolor: "rgba(34,197,94,0.1)" },
  medium: { bgcolor: "rgba(250,204,21,0.1)" },
  hard: { bgcolor: "rgba(251,146,60,0.1)" },
  expert: { bgcolor: "rgba(239,68,68,0.1)" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  medium: "#facc15",
  hard: "#fb923c",
  expert: "#ef4444",
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}min ${s}s`;
}

function ChallengeCard({ challenge, onStart }: { challenge: Challenge; onStart: (id: string) => void }) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    await onStart(challenge.id);
    setStarting(false);
  };

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        "&:hover": { borderColor: "rgba(161,161,170,0.6)" },
        transition: "border-color 0.2s",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.375, color: "#f4f4f5" }}>
          {challenge.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 500,
            px: 1,
            py: 0.25,
            borderRadius: "4px",
            flexShrink: 0,
            ...(DIFFICULTY_SX[challenge.difficulty] || { bgcolor: "background.paper" }),
            color: DIFFICULTY_COLORS[challenge.difficulty] || "#a1a1aa",
          }}
        >
          {challenge.difficulty}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          lineHeight: 1.625,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          color: "#a1a1aa",
        }}
      >
        {challenge.description}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "auto" }}>
        <Typography variant="caption" sx={{ color: "#71717a", display: "flex", alignItems: "center", gap: 0.5 }}>
          <Clock size={16} />
          {formatTime(challenge.timeLimitSeconds)}
        </Typography>
        <Button
          onClick={handleStart}
          disabled={starting}
          size="small"
          sx={{
            px: 1.5,
            py: 0.75,
            fontSize: "11px",
            fontWeight: 500,
            bgcolor: "rgba(59,130,246,0.2)",
            color: "#60a5fa",
            borderRadius: "4px",
            minWidth: 0,
            lineHeight: 1,
            "&:hover": { bgcolor: "rgba(59,130,246,0.3)" },
            "&.Mui-disabled": { opacity: 0.5 },
          }}
        >
          {starting ? "Starting..." : "Start Challenge"}
        </Button>
      </Box>
    </Box>
  );
}

export default function ChallengesPage() {
  const navigate = useNavigate();
  const { challenges, challengesLoading, challengesError, fetchChallenges, startChallenge } = useChallengeStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const handleStart = async (challengeId: string) => {
    try {
      setError(null);
      const projectId = await startChallenge(challengeId);
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      setError(err.message || "Failed to start challenge");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column", color: "#f4f4f5" }}>
      <Box
        component="header"
        sx={{
          height: 52,
          flexShrink: 0,
          bgcolor: "background.default",
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          px: 3,
          gap: 1.5,
        }}
      >
        <Button
          onClick={() => navigate("/dashboard")}
          sx={{ minWidth: 0, p: 0, color: "#a1a1aa", fontSize: "14px", "&:hover": { bgcolor: "transparent" } }}
        >
          <ArrowLeft size={16} />
        </Button>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Challenges
        </Typography>
      </Box>

      <Box component="main" sx={{ flex: 1, p: 3, maxWidth: 896, mx: "auto", width: "100%" }}>
        {error && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: "rgba(239,68,68,0.1)",
              border: "1px solid",
              borderColor: "rgba(239,68,68,0.2)",
              borderRadius: 1,
              fontSize: "12px",
              color: "#ef4444",
            }}
          >
            {error}
          </Box>
        )}

        {challengesLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 10 }}>
            <CircularProgress size={32} sx={{ color: "#60a5fa" }} />
          </Box>
        ) : challengesError ? (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Typography variant="body2" sx={{ mb: 1, color: "#ef4444" }}>
              {challengesError}
            </Typography>
            <Button onClick={fetchChallenges} size="small" sx={{ fontSize: "12px", color: "#60a5fa", minWidth: 0 }}>
              Retry
            </Button>
          </Box>
        ) : challenges.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <Typography variant="caption" sx={{ color: "#71717a" }}>
              No challenges available yet.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {challenges.map((c) => (
              <Grid key={c.id} size={{ xs: 12, md: 6 }}>
                <ChallengeCard challenge={c} onStart={handleStart} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
