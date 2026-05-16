import { create } from "zustand";
import api from "../utils/api";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  canvas_data: Record<string, any>;
  metadata: Record<string, any>;
  role: string;
}

interface ProjectState {
  projects: Project[];
  totalProjects: number;
  currentPage: number;
  currentProject: ProjectDetail | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: (page?: number) => Promise<void>;
  getProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string, is_public?: boolean) => Promise<Project>;
  updateProject: (id: string, data: Partial<{ name: string; description: string | null; is_public: boolean; canvas_data: string; metadata: string }>) => Promise<void>;
  saveCanvas: (id: string, canvasData: Record<string, any>) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: ProjectDetail | null) => void;
  clearError: () => void;
}

const PAGE_LIMIT = 20;

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  totalProjects: 0,
  currentPage: 1,
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async (page) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      params.set("page", String(page ?? 1));
      params.set("limit", String(PAGE_LIMIT));
      const { data } = await api.get(`/projects/?${params}`);
      set({
        projects: data.projects,
        totalProjects: data.total,
        currentPage: data.page,
        isLoading: false,
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to load projects";
      set({ error: msg, isLoading: false });
    }
  },

  getProject: async (id) => {
    set({ isLoading: true, error: null, currentProject: null });
    try {
      const { data } = await api.get(`/projects/${id}`);
      set({ currentProject: data.project, isLoading: false });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to load project";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  createProject: async (name, description, is_public) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post("/projects/", { name, description, is_public });
      set((state) => ({
        projects: [data.project, ...state.projects],
        totalProjects: state.totalProjects + 1,
        isLoading: false,
      }));
      return data.project;
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to create project";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  updateProject: async (id, update) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.put(`/projects/${id}`, update);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...data.project } : p)),
        currentProject: data.project,
        isLoading: false,
      }));
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to update project";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  saveCanvas: async (id, canvasData) => {
    const { data } = await api.put(`/projects/${id}/canvas`, { canvas_data: canvasData });
    return data.updated_at;
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/projects/${id}`);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        totalProjects: state.totalProjects - 1,
        isLoading: false,
      }));
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to delete project";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  clearError: () => set({ error: null }),
}));
