import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../store/projectStore";
import { Card, CardContent, CardActions, Typography, Box, Button } from "@mui/material";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirming) {
        onDelete(project.id);
        setConfirming(false);
      } else {
        setConfirming(true);
        setTimeout(() => setConfirming(false), 3000);
      }
    },
    [confirming, onDelete, project.id],
  );

  return (
    <Card
      onClick={() => navigate(`/project/${project.id}`)}
      sx={{
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: 1,
        borderColor: "divider",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </Typography>
        </Box>

        {project.description && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {project.description}
          </Typography>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
          {project.is_public ? (
            <Typography
              variant="caption"
              sx={{ color: "success.main", bgcolor: "rgba(34,197,94,0.15)", px: 0.75, py: 0.25, borderRadius: "999px", border: 1, borderColor: "rgba(34,197,94,0.3)" }}
            >
              public
            </Typography>
          ) : (
            <Typography
              variant="caption"
              sx={{ color: "text.disabled", bgcolor: "action.hover", px: 0.75, py: 0.25, borderRadius: "999px" }}
            >
              private
            </Typography>
          )}
          <Typography variant="caption" color="text.disabled">
            {new Date(project.updated_at).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: "flex-end", pt: 0 }}>
        <Button
          size="small"
          onClick={handleDelete}
          color={confirming ? "error" : "inherit"}
          sx={{ fontSize: "0.65rem", minWidth: 0, opacity: confirming ? 1 : 0, transition: "opacity 0.15s ease", "&:hover": confirming ? {} : { opacity: 1 } }}
        >
          {confirming ? "Confirm?" : "delete"}
        </Button>
      </CardActions>
    </Card>
  );
}
