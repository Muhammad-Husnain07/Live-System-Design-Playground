import axios from "axios";
import { useToastStore } from "../store/toastStore";

let isRefreshing = false;
let pendingRequests: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

export function getErrorMessage(err: any, fallback: string): string {
  if (err?.response?.data?.error) return err.response.data.error;

  const status = err?.response?.status;
  if (!status && !err?.request) return fallback;
  if (!status && err?.request) return "Check your connection and try again.";
  if (status === 400 || status === 422) return err?.response?.data?.error || "Please check your input and try again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return "This item no longer exists.";
  if (status === 409) return "This conflicts with existing data. Refresh and try again.";
  if (status >= 500) return "Something went wrong on our end. Try again.";
  return fallback;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/auth/refresh")) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const oldToken = localStorage.getItem("auth_token");
        if (!oldToken) throw new Error("no token");
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${oldToken}` } },
        );
        localStorage.setItem("auth_token", data.token);
        isRefreshing = false;
        pendingRequests.forEach((p) => p.resolve(data.token));
        pendingRequests = [];
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        pendingRequests.forEach((p) => p.reject(err));
        pendingRequests = [];
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    if (err.response?.status && err.response.status >= 500) {
      try {
        useToastStore.getState().addToast({
          type: "error",
          title: "Server error",
          message: err.response?.data?.error || "Something went wrong on our end. Try again.",
          duration: 7000,
        });
      } catch { /* toast unavailable */ }
    }
    return Promise.reject(err);
  },
);

export default api;
