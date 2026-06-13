import { useCallback } from "react";
import { Box, IconButton, Tooltip, Divider } from "@mui/material";
import { LayoutGrid, Shapes, Search, Settings } from "lucide-react";

export type SidebarView = "components" | "templates" | "search" | null;

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

const TOP_ICONS: { view: "components" | "templates" | "search"; icon: typeof LayoutGrid; label: string }[] = [
  { view: "components", icon: LayoutGrid, label: "Components" },
  { view: "templates", icon: Shapes, label: "Templates" },
  { view: "search", icon: Search, label: "Search" },
];

export default function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  const handleClick = useCallback((view: "components" | "templates" | "search") => {
    onViewChange(activeView === view ? null : view);
  }, [activeView, onViewChange]);

  return (
    <Box
      sx={{
        width: 48,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pt: 1,
        gap: 0.5,
        bgcolor: "background.elevated",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {TOP_ICONS.map(({ view, icon: Icon, label }) => {
        const isActive = activeView === view;
        return (
          <Tooltip key={view} title={label} arrow placement="right">
            <Box sx={{ position: "relative", width: 48, display: "flex", justifyContent: "center", alignItems: "center", height: 40 }}>
              {isActive && (
                <Box
                  sx={{
                    position: "absolute", left: 0, top: 6, bottom: 6,
                    width: 2, bgcolor: "primary.main", borderRadius: "0 2px 2px 0",
                  }}
                />
              )}
              <IconButton
                onClick={() => handleClick(view)}
                size="small"
                sx={{
                  color: isActive ? "primary.main" : "text.secondary",
                  bgcolor: isActive ? "rgba(99,102,241,0.1)" : "transparent",
                  borderRadius: 1, p: 1, width: 32, height: 32,
                  transition: "all 0.15s ease",
                  "&:hover": { bgcolor: isActive ? "rgba(99,102,241,0.15)" : "background.hover", color: isActive ? "primary.main" : "text.primary" },
                }}
              >
                <Icon size={18} />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
      <Divider sx={{ width: 20, my: 0.5, borderColor: "divider" }} />
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Settings" arrow placement="right">
        <IconButton
          size="small"
          sx={{
            color: "text.secondary", mb: 1, borderRadius: 1, width: 32, height: 32,
            "&:hover": { color: "text.primary", bgcolor: "background.hover" },
          }}
        >
          <Settings size={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
