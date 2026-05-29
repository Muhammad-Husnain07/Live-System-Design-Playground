import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import { useChallengeStore, type Challenge } from "../store/challengeStore";

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: "bg-green-500/10",
  medium: "bg-yellow-500/10",
  hard: "bg-orange-500/10",
  expert: "bg-red-500/10",
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
    <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 flex flex-col gap-3 hover:border-surface-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug" style={{ color: '#f4f4f5' }}>{challenge.title}</h3>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${DIFFICULTY_CLASSES[challenge.difficulty] || "bg-surface-800"}`}
          style={{ color: DIFFICULTY_COLORS[challenge.difficulty] || '#a1a1aa' }}
        >
          {challenge.difficulty}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: '#a1a1aa' }}>{challenge.description}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px]" style={{ color: '#71717a' }}>
          <Clock className="h-4 w-4" /> {formatTime(challenge.timeLimitSeconds)}
        </span>
        <button
          onClick={handleStart}
          disabled={starting}
          className="px-3 py-1.5 text-[11px] font-medium bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors disabled:opacity-50"
          style={{ color: '#60a5fa' }}
        >
          {starting ? "Starting..." : "Start Challenge"}
        </button>
      </div>
    </div>
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
    <div className="min-h-screen bg-surface-950 flex flex-col" style={{ color: '#f4f4f5' }}>
      <header className="h-[52px] shrink-0 bg-surface-950 border-b border-surface-800 flex items-center px-6 gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm transition-colors"
          style={{ color: '#a1a1aa' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold">Challenges</h1>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs" style={{ color: '#ef4444' }}>
            {error}
          </div>
        )}

        {challengesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-surface-400 border-t-blue-500 rounded-full" />
          </div>
        ) : challengesError ? (
          <div className="text-center py-20">
            <p className="text-sm mb-2" style={{ color: '#ef4444' }}>{challengesError}</p>
            <button onClick={fetchChallenges} className="text-xs transition-colors" style={{ color: '#60a5fa' }}>
              Retry
            </button>
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xs" style={{ color: '#71717a' }}>No challenges available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} onStart={handleStart} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
