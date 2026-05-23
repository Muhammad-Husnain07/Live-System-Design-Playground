import axios from "axios";
import { useToastStore } from "../store/toastStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
    } else if (err.response?.status && err.response.status >= 500) {
      try {
        useToastStore.getState().addToast({
          type: "error",
          title: "Server error",
          message: err.response?.data?.error || `Something went wrong (${err.response.status})`,
          duration: 5000,
        });
      } catch { /* toast unavailable */ }
    }
    return Promise.reject(err);
  }
);

export default api;
