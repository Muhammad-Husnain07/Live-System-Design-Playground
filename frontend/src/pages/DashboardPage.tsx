import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import ProjectCard from "../components/ui/ProjectCard";
import NewProjectModal from "../components/ui/NewProjectModal";
import ImportModal from "../components/panels/ImportModal";
import { Plus } from "lucide-react";
import { SkeletonCard } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { Box, Typography, Button, Grid, Avatar, Menu, MenuItem } from "@mui/material";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const navigate = useNavigate();
  const { projects, totalProjects, currentPage, isLoading, error, fetchProjects, createProject, deleteProject } = useProjectStore(useShallow((s) => ({ projects: s.projects, totalProjects: s.totalProjects, currentPage: s.currentPage, isLoading: s.isLoading, error: s.error, fetchProjects: s.fetchProjects, createProject: s.createProject, deleteProject: s.deleteProject })));
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchProjects(page);
  }, [fetchProjects, page]);

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
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          px: 3,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Typography
          onClick={() => navigate("/dashboard")}
          variant="h6"
          sx={{ fontWeight: 700, letterSpacing: "-0.02em", color: "primary.main", cursor: "pointer", userSelect: "none" }}
        >
          LSDP
        </Typography>

        <Box>
          <Button
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ color: "text.secondary", textTransform: "none", display: "flex", alignItems: "center", gap: 1 }}
          >
            <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", fontWeight: 500, bgcolor: "action.hover", color: "text.secondary" }}>
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
              {user?.username}
            </Typography>
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => { setAnchorEl(null); navigate("/settings"); }}>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }} sx={{ "&:hover": { color: "error.main" } }}>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, px: 3, py: 3, maxWidth: 1024, mx: "auto", width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, color: "text.primary" }}>
            Projects
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" color="primary" onClick={() => setShowImportModal(true)} sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
              Import
            </Button>
            <Button variant="contained" onClick={() => setShowNewModal(true)}>
              New Project
            </Button>
          </Box>
        </Box>

        {error && (
          <Typography
            variant="caption"
            sx={{ mb: 2, p: 1.5, display: "block", color: "error.main", bgcolor: "rgba(239,68,68,0.1)", borderRadius: 1, border: 1, borderColor: "rgba(239,68,68,0.3)" }}
          >
            {error}
          </Typography>
        )}

        {isLoading && projects.length === 0 ? (
          <Grid container spacing={3} columns={12}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <SkeletonCard lines={3} />
              </Grid>
            ))}
          </Grid>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Plus size={24} />}
            title="No projects yet"
            description="Create your first architecture to get started."
            action={
              <Button variant="contained" onClick={() => setShowNewModal(true)}>
                Create Project
              </Button>
            }
          />
        ) : (
          <>
            <Grid container spacing={3} columns={12}>
              {projects.map((p) => (
                <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ProjectCard project={p} onDelete={handleDelete} />
                </Grid>
              ))}
            </Grid>

            {totalPages > 1 && (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 3 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  sx={{ minWidth: 0 }}
                >
                  Prev
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Page {currentPage} of {totalPages}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  sx={{ minWidth: 0 }}
                >
                  Next
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <NewProjectModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleCreate}
      />
    </Box>
  );
}
