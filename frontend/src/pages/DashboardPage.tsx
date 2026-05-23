import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import ProjectCard from "../components/ui/ProjectCard";
import NewProjectModal from "../components/ui/NewProjectModal";
import ImportModal from "../components/panels/ImportModal";
import { SkeletonCard } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="+"
            title="No projects yet"
            description="Create your first architecture to get started."
            action={
              <button
                onClick={() => setShowNewModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Create Project
              </button>
            }
          />
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
