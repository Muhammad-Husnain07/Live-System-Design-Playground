import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChallengeStore } from "../store/challengeStore";

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { leaderboard, leaderboardLoading, fetchLeaderboard } = useChallengeStore();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex flex-col">
      <header className="h-[52px] shrink-0 bg-surface-950 border-b border-surface-800 flex items-center px-6 gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
        >
          &larr;
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
            <p className="text-xs text-surface-500">No submissions yet. Complete a challenge to appear here!</p>
          </div>
        ) : (
          <div className="bg-surface-900 border border-surface-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800 text-[10px] uppercase tracking-wider text-surface-500">
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
                      {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : (
                        <span className="text-surface-500 font-mono">{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-surface-200 font-medium">{entry.username}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-100">{entry.score.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.passed ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                        {entry.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-surface-500">
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
