import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, textAlign: "center", px: 2 }}>
      {icon && (
        <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5 }}>
          <Typography variant="body2" sx={{ color: "#71717a", fontSize: "1rem" }}>{icon}</Typography>
        </Box>
      )}
      <Typography variant="body2" sx={{ color: "#a1a1aa", mb: 0.5 }}>{title}</Typography>
      {description && <Typography variant="caption" sx={{ color: "#52525b", mb: 2, maxWidth: 280 }}>{description}</Typography>}
      {action}
    </Box>
  );
}
