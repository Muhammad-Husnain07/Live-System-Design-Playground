import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import ProjectCard from "../components/ui/ProjectCard";
import NewProjectModal from "../components/ui/NewProjectModal";
import ImportModal from "../components/panels/ImportModal";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { projects, totalProjects, currentPage, isLoading, error, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchProjects(page);
  }, [fetchProjects, page]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserMenu]);

  const handleCreate = useCallback(async (name: string, description: string | undefined, isPublic: boolean) => {
    const p = await createProject(name, description, isPublic);
    navigate(`/project/${p.id}`);
  }, [createProject, navigate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
    } catch {}
  }, [deleteProject]);

  const totalPages = Math.ceil(totalProjects / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex flex-col">
      <header className="border-b border-surface-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div
          onClick={() => navigate("/dashboard")}
          className="text-lg font-bold tracking-tight text-green-400 cursor-pointer select-none"
        >
          LSDP
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 text-sm text-surface-300 hover:text-surface-100 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-medium text-surface-300">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </span>
            <span className="hidden sm:inline">{user?.username}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
                className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors"
              >
                Profile
              </button>
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full text-left px-3 py-2 text-sm text-surface-300 hover:text-red-400 hover:bg-surface-700 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-surface-100">Projects</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors"
            >
              New Project
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {isLoading && projects.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-surface-400 border-t-green-500 rounded-full" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <p className="text-surface-400 text-sm mb-1">No projects yet</p>
            <p className="text-surface-500 text-xs mb-4">Create your first architecture</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 disabled:opacity-40 rounded transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-surface-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 disabled:opacity-40 rounded transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <NewProjectModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
