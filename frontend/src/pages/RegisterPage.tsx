import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Box, Paper, Typography, TextField, Button } from "@mui/material";

import { useShallow } from "zustand/react/shallow";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading, error, clearError } = useAuthStore(useShallow((s) => ({ register: s.register, isAuthenticated: s.isAuthenticated, isLoading: s.isLoading, error: s.error, clearError: s.clearError })));
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; username?: string; password?: string; confirm?: string }>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!EMAIL_REGEX.test(email)) errors.email = "Enter a valid email address";
    if (email.length > 100) errors.email = "Email is too long";
    if (username.length < 3 || username.length > 20) errors.username = "Must be 3–20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) errors.username = "Letters, numbers, underscores only";
    if (password.length < 8) errors.password = "At least 8 characters";
    if (password !== confirm) errors.confirm = "Passwords do not match";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    clearError();
    if (!validate()) return;
    try {
      await register(email, username, password);
    } catch (caught: any) {
      setErr(caught.message);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", px: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
            Create Account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Join Live System Design Playground
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            id="reg-email"
            label="Email"
            type="email"
            required
            fullWidth
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
            placeholder="you@example.com"
            error={!!fieldErrors.email}
            helperText={fieldErrors.email}
          />

          <TextField
            id="reg-username"
            label="Username"
            required
            fullWidth
            value={username}
            onChange={(e) => { setUsername(e.target.value); setFieldErrors((p) => ({ ...p, username: undefined })); }}
            placeholder="myuser"
            error={!!fieldErrors.username}
            helperText={fieldErrors.username}
          />

          <TextField
            id="reg-password"
            label="Password"
            type="password"
            required
            fullWidth
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
            placeholder="••••••••"
            error={!!fieldErrors.password}
            helperText={fieldErrors.password}
          />

          <TextField
            id="reg-confirm"
            label="Confirm password"
            type="password"
            required
            fullWidth
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setFieldErrors((p) => ({ ...p, confirm: undefined })); }}
            placeholder="••••••••"
            error={!!fieldErrors.confirm}
            helperText={fieldErrors.confirm}
          />

          {(err || error) && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              {err || error}
            </Typography>
          )}

          <Button type="submit" variant="contained" fullWidth disabled={isLoading} sx={{ mt: 1 }}>
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 3 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#60a5fa", textDecoration: "none" }}>
            Sign in
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
