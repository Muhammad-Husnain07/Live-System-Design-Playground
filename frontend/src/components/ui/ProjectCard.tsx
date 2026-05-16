import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../store/projectStore";

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
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="group relative border border-surface-800 rounded-lg p-4 hover:border-green-600 cursor-pointer transition-all bg-surface-900/50 hover:bg-surface-900"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-medium text-sm truncate text-surface-100">{project.name}</h3>
        <button
          onClick={handleDelete}
          className={`shrink-0 ml-2 text-xs px-2 py-0.5 rounded transition-all ${
            confirming
              ? "bg-red-700 text-white"
              : "opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400"
          }`}
          title="Delete project"
        >
          {confirming ? "Confirm?" : "delete"}
        </button>
      </div>

      {project.description && (
        <p className="text-xs text-surface-400 mt-1.5 line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        {project.is_public ? (
          <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded-full border border-green-800/40">
            public
          </span>
        ) : (
          <span className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded-full">
            private
          </span>
        )}
        <span className="text-[10px] text-surface-500">
          {new Date(project.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
