import { create } from "zustand";
import api from "../utils/api";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  requirements: any;
  initial_canvas: any;
  timeLimitSeconds: number;
  passingCriteria: any;
}

export interface ScoreReport {
  cost: number;
  reliability: number;
  performance: number;
  total: number;
  passed: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  passed: boolean;
  submittedAt: string;
}

interface ChallengeStore {
  challenges: Challenge[];
  challengesLoading: boolean;
  challengesError: string | null;

  activeChallenge: {
    id: string;
    title: string;
    projectId: string;
    timeLimitMs: number;
    startedAt: number;
  } | null;

  submitting: boolean;
  scoreReport: ScoreReport | null;

  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;

  fetchChallenges: () => Promise<void>;
  startChallenge: (challengeId: string) => Promise<string>;
  submitChallenge: (challengeId: string, projectId: string) => Promise<ScoreReport>;
  clearActiveChallenge: () => void;
  fetchLeaderboard: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  challenges: [],
  challengesLoading: false,
  challengesError: null,

  activeChallenge: null,
  submitting: false,
  scoreReport: null,

  leaderboard: [],
  leaderboardLoading: false,

  fetchChallenges: async () => {
    set({ challengesLoading: true, challengesError: null });
    try {
      const { data } = await api.get("/challenges");
      set({ challenges: data.challenges || [], challengesLoading: false });
    } catch (err: any) {
      set({ challengesError: err.response?.data?.error || "Failed to load challenges", challengesLoading: false });
    }
  },

  startChallenge: async (challengeId) => {
    const { data } = await api.post(`/challenges/${challengeId}/start`);
    const project = data.project as { id: string };
    const challenge = data.challenge as Challenge;
    set({
      activeChallenge: {
        id: challengeId,
        title: challenge.title,
        projectId: project.id,
        timeLimitMs: data.timeLimitMs as number,
        startedAt: Date.now(),
      },
    });
    return project.id;
  },

  submitChallenge: async (challengeId, projectId) => {
    set({ submitting: true, scoreReport: null });
    try {
      const { data } = await api.post(`/challenges/${challengeId}/submit`, { projectId });
      const report = data.score as ScoreReport;
      set({ submitting: false, scoreReport: report });
      return report;
    } catch (err: any) {
      set({ submitting: false });
      throw new Error(err.response?.data?.error || "Submission failed");
    }
  },

  clearActiveChallenge: () => {
    set({ activeChallenge: null, scoreReport: null, submitting: false });
  },

  fetchLeaderboard: async () => {
    set({ leaderboardLoading: true });
    try {
      const { data } = await api.get("/challenges/leaderboard");
      set({ leaderboard: data.leaderboard || [], leaderboardLoading: false });
    } catch {
      set({ leaderboard: [], leaderboardLoading: false });
    }
  },
}));
