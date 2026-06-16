import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCanvasStore } from "../../store/canvasStore";
import { useAuthStore } from "../../store/authStore";
import {
  Box, Typography, Menu, MenuItem, Avatar, AvatarGroup, Tooltip,
} from "@mui/material";

interface StatusBarProps {
  saving: boolean;
  collabConnected: boolean;
  remoteUsers: { clientId: number; name: string; color: string }[];
}

const pulseKeyframes = {
  "@keyframes pulse-dot": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.3 },
  },
};

function SaveDot({ saving, isDirty }: { saving: boolean; isDirty: boolean }) {
  const color = saving ? "#eab308" : isDirty ? "#fb923c" : "#22c55e";
  return (
    <Box
      sx={{
        width: 5, height: 5, borderRadius: "50%", bgcolor: color, flexShrink: 0,
        animation: saving || isDirty ? "pulse-dot 1.2s ease-in-out infinite" : "none",
        ...pulseKeyframes,
      }}
    />
  );
}

export default function StatusBar({ saving, collabConnected, remoteUsers }: StatusBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isDirty = useCanvasStore((s) => s.isDirty);
  const lastSaved = useCanvasStore((s) => s.lastSaved);
  const [userAnchorEl, setUserAnchorEl] = useState<HTMLElement | null>(null);

  const saveLabel = saving ? "Saving" : isDirty ? "Unsaved" : lastSaved ? "Saved" : "";

  return (
    <motion.div
      className="floating-island"
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 80,
        background: "rgba(5,5,7,0.75)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        padding: "6px 14px",
        height: 40,
        userSelect: "none",
      }}
    >
      {/* Save status */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
        <SaveDot saving={saving} isDirty={isDirty} />
        <Typography
          sx={{
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: '"Inter", sans-serif',
            fontWeight: 500,
            minWidth: 40,
          }}
        >
          {saveLabel}
        </Typography>
      </Box>

      {/* Collab status */}
      {collabConnected && (
        <Tooltip title="Collaborators connected" arrow>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#22C55E", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
            <Typography sx={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", fontFamily: '"JetBrains Mono", monospace' }}>
              LIVE
            </Typography>
          </Box>
        </Tooltip>
      )}

      {!collabConnected && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", fontFamily: '"JetBrains Mono", monospace' }}>
            OFFLINE
          </Typography>
        </Box>
      )}

      <Box sx={{ width: 1, height: 16, bgcolor: "rgba(255,255,255,0.06)" }} />

      {/* Collaborator avatars */}
      {collabConnected && remoteUsers.length > 0 && (
        <AvatarGroup
          max={3}
          sx={{
            "& .MuiAvatar-root": {
              width: 20, height: 20, fontSize: "0.45rem", fontWeight: 700,
              border: "1.5px solid rgba(5,5,7,0.9)", ml: -0.5,
            },
          }}
        >
          {remoteUsers.map((u) => (
            <Tooltip key={u.clientId} title={u.name} arrow>
              <Avatar sx={{ bgcolor: u.color, color: "#fff", fontFamily: '"Inter", sans-serif' }}>
                {u.name.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}

      {/* User avatar */}
      <Box
        onClick={(e) => setUserAnchorEl(e.currentTarget)}
        sx={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.25,
        }}
      >
        <Box
          sx={{
            width: 20, height: 20, borderRadius: "50%",
            bgcolor: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.55rem", fontWeight: 600,
            color: "#6366F1",
            fontFamily: '"Inter", sans-serif',
          }}
        >
          {user?.username?.charAt(0).toUpperCase() ?? "?"}
        </Box>
        <Typography
          sx={{
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.5)",
            fontFamily: '"Inter", sans-serif',
            fontWeight: 500,
            maxWidth: 56,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.username ?? "User"}
        </Typography>
      </Box>

      <Menu
        anchorEl={userAnchorEl}
        open={Boolean(userAnchorEl)}
        onClose={() => setUserAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(20,20,24,0.92)", backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            },
          },
        }}
      >
        <MenuItem disabled dense>
          <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{user?.email ?? ""}</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setUserAnchorEl(null); navigate("/settings"); }} dense>
          <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)" }}>Settings</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setUserAnchorEl(null); logout(); navigate("/login"); }} dense>
          <Typography sx={{ fontSize: "0.65rem", color: "#EF4444" }}>Sign Out</Typography>
        </MenuItem>
      </Menu>
    </motion.div>
  );
}
