import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, TextField, Button } from "@mui/material";
import api from "../utils/api";
import { useAuthStore } from "../store/authStore";

import { useShallow } from "zustand/react/shallow";

export default function ProfilePage() {
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");

  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    api.get("/users/me/profile").then(({ data }) => {
      setEmail(data.user.email);
      setUsername(data.user.username);
      const d = new Date(data.user.created_at);
      setCreatedAt(d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
    }).catch(() => {});
  }, []);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    setProfileLoading(true);
    try {
      const body: Record<string, string> = {};
      if (email !== user?.email) body.email = email;
      if (username !== user?.username) body.username = username;
      if (Object.keys(body).length === 0) {
        setProfileErr("No changes to save");
        setProfileLoading(false);
        return;
      }
      const { data } = await api.put("/users/me/profile", body);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      useAuthStore.setState({ user: data.user });
      setProfileMsg("Profile updated");
    } catch (err: any) {
      setProfileErr(err.response?.data?.error || "Update failed");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordErr("");
    if (cpNew.length < 8) { setPasswordErr("Password must be at least 8 characters"); return; }
    if (cpNew !== cpConfirm) { setPasswordErr("Passwords do not match"); return; }
    setPasswordLoading(true);
    try {
      await api.put("/users/me/password", { current_password: cpCurrent, new_password: cpNew });
      setPasswordMsg("Password changed");
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
    } catch (err: any) {
      setPasswordErr(err.response?.data?.error || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteErr("");
    if (deleteConfirm !== "DELETE") { setDeleteErr("Type DELETE to confirm"); return; }
    try {
      await api.delete("/users/me/account");
      logout();
      navigate("/login");
    } catch (err: any) {
      setDeleteErr(err.response?.data?.error || "Failed to delete account");
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 6, py: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Settings</Typography>
        <Button onClick={() => navigate("/dashboard")} variant="text" sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.875rem' }}>Back to Dashboard</Button>
      </Box>

      <Box component="main" sx={{ maxWidth: 672, mx: 'auto', p: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>Edit Profile</Typography>
          {createdAt && <Typography variant="caption" sx={{ mb: 4, display: 'block', color: '#71717a' }}>Member since {createdAt}</Typography>}
          <Box component="form" onSubmit={handleProfile} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              fullWidth size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            <TextField label="Username" type="text" value={username} onChange={e => setUsername(e.target.value)}
              fullWidth size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            {profileMsg && <Typography variant="body2" sx={{ color: '#22c55e' }}>{profileMsg}</Typography>}
            {profileErr && <Typography variant="body2" sx={{ color: '#ef4444' }}>{profileErr}</Typography>}
            <Button type="submit" disabled={profileLoading} variant="contained"
              sx={{ alignSelf: 'flex-start', textTransform: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' }, '&.Mui-disabled': { bgcolor: '#3f3f46', color: '#a1a1aa' } }}>
              {profileLoading ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 4 }}>Change Password</Typography>
          <Box component="form" onSubmit={handlePassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 384 }}>
            <TextField label="Current password" type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required
              fullWidth size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            <TextField label="New password" type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required
              fullWidth size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            <TextField label="Confirm new password" type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required
              fullWidth size="small"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#3b82f6' } }, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            {passwordMsg && <Typography variant="body2" sx={{ color: '#22c55e' }}>{passwordMsg}</Typography>}
            {passwordErr && <Typography variant="body2" sx={{ color: '#ef4444' }}>{passwordErr}</Typography>}
            <Button type="submit" disabled={passwordLoading} variant="contained"
              sx={{ alignSelf: 'flex-start', textTransform: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#3b82f6' }, '&.Mui-disabled': { bgcolor: '#3f3f46', color: '#a1a1aa' } }}>
              {passwordLoading ? "Updating…" : "Update password"}
            </Button>
          </Box>
        </Box>

        <Box sx={{ border: 1, borderColor: 'rgba(127, 29, 29, 0.5)', borderRadius: '8px', p: 5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1, color: '#ef4444' }}>Danger Zone</Typography>
          <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>Permanently delete your account and all associated data.</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField placeholder='Type "DELETE" to confirm' value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              size="small"
              sx={{ maxWidth: 320, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: 'divider' }, '&.Mui-focused fieldset': { borderColor: '#ef4444' } }, '& .MuiInputBase-input': { color: 'text.primary' } }} />
            {deleteErr && <Typography variant="body2" sx={{ color: '#ef4444' }}>{deleteErr}</Typography>}
            <Button onClick={handleDelete} disabled={deleteConfirm !== "DELETE"} variant="contained"
              sx={{ alignSelf: 'flex-start', textTransform: 'none', bgcolor: '#b91c1c', '&:hover': { bgcolor: '#dc2626' }, '&.Mui-disabled': { bgcolor: '#3f3f46', color: '#a1a1aa' } }}>
              Delete my account
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
