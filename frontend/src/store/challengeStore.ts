import { create } from "zustand";
import api, { getErrorMessage } from "../utils/api";
import { useToastStore } from "./toastStore";

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
  leaderboardError: string | null;

  fetchChallenges: () => Promise<void>;
  startChallenge: (challengeId: string) => Promise<string>;
  submitChallenge: (challengeId: string, projectId: string) => Promise<ScoreReport>;
  clearActiveChallenge: () => void;
  fetchLeaderboard: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeStore>((set) => ({
  challenges: [],
  challengesLoading: false,
  challengesError: null,

  activeChallenge: null,
  submitting: false,
  scoreReport: null,

  leaderboard: [],
  leaderboardLoading: false,
  leaderboardError: null,

  fetchChallenges: async () => {
    set({ challengesLoading: true, challengesError: null });
    try {
      const { data } = await api.get("/challenges");
      set({ challenges: data.challenges || [], challengesLoading: false });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to load challenges.");
      set({ challengesError: msg, challengesLoading: false });
    }
  },

  startChallenge: async (challengeId) => {
    try {
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
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to start challenge.");
      useToastStore.getState().addToast({ type: "error", title: "Challenge start failed", message: msg, duration: 5000 });
      throw new Error(msg);
    }
  },

  submitChallenge: async (challengeId, projectId) => {
    set({ submitting: true, scoreReport: null });
    try {
      const { data } = await api.post(`/challenges/${challengeId}/submit`, { projectId });
      const report = data.score as ScoreReport;
      set({ submitting: false, scoreReport: report });
      return report;
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to submit challenge.");
      set({ submitting: false });
      useToastStore.getState().addToast({ type: "error", title: "Submission failed", message: msg, duration: 5000 });
      throw new Error(msg);
    }
  },

  clearActiveChallenge: () => {
    set({ activeChallenge: null, scoreReport: null, submitting: false });
  },

  fetchLeaderboard: async () => {
    set({ leaderboardLoading: true, leaderboardError: null });
    try {
      const { data } = await api.get("/challenges/leaderboard");
      set({ leaderboard: data.leaderboard || [], leaderboardLoading: false });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Failed to load leaderboard.");
      set({ leaderboard: [], leaderboardLoading: false, leaderboardError: msg });
    }
  },
}));
