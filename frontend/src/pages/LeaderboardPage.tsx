import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, Award, ArrowLeft } from "lucide-react";
import { useChallengeStore } from "../store/challengeStore";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { leaderboard, leaderboardLoading, fetchLeaderboard } = useChallengeStore();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

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
        <h1 className="text-sm font-semibold">Leaderboard</h1>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {leaderboardLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-surface-400 border-t-blue-500 rounded-full" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xs" style={{ color: '#71717a' }}>No submissions yet. Complete a challenge to appear here!</p>
          </div>
        ) : (
          <div className="bg-surface-900 border border-surface-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800 text-[10px] uppercase tracking-wider" style={{ color: '#71717a' }}>
                  <th className="text-left px-4 py-2.5 font-medium w-12">Rank</th>
                  <th className="text-left px-4 py-2.5 font-medium">Username</th>
                  <th className="text-right px-4 py-2.5 font-medium w-20">Score</th>
                  <th className="text-right px-4 py-2.5 font-medium w-16">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium w-28">Date</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={`${entry.rank}-${entry.username}`} className="border-b border-surface-800/50 last:border-b-0 hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      {entry.rank === 1 ? <Trophy className="h-5 w-5" style={{ color: '#facc15' }} /> : entry.rank === 2 ? <Medal className="h-5 w-5" style={{ color: '#a1a1aa' }} /> : entry.rank === 3 ? <Award className="h-5 w-5" style={{ color: '#b45309' }} /> : (
                        <span className="font-mono" style={{ color: '#71717a' }}>{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#f4f4f5' }}>{entry.username}</td>
                    <td className="px-4 py-2.5 text-right font-mono" style={{ color: '#f4f4f5' }}>{entry.score.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.passed ? "bg-green-500/10" : "bg-red-500/10"}`} style={{ color: entry.passed ? '#22c55e' : '#ef4444' }}>
                        {entry.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: '#71717a' }}>
                      {new Date(entry.submittedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
