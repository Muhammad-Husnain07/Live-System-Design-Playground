import { create } from "zustand";
import api, { getErrorMessage } from "../utils/api";
import { useToastStore } from "./toastStore";

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  fetchWsTicket: () => Promise<string>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("auth_token"),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Login failed. Check your email and password.");
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post("/auth/register", { email, username, password });
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const msg = getErrorMessage(err, "Registration failed. Try a different email or username.");
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
  },

  checkAuth: async () => {
    const token = get().token || localStorage.getItem("auth_token");
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      set({ user: data.user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      } else {
        const msg = getErrorMessage(err, "Could not verify your session.");
        set({ error: msg, isLoading: false });
      }
    }
  },

  fetchWsTicket: async () => {
    try {
      const { data } = await api.post("/auth/ws-ticket");
      return data.ticket;
    } catch (err: any) {
      const msg = getErrorMessage(err, "Could not connect to collaboration service.");
      useToastStore.getState().addToast({ type: "error", title: "Connection failed", message: msg, duration: 5000 });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
}));
