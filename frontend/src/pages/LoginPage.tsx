import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Box, Paper, Typography, TextField, Button } from "@mui/material";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.includes("@")) errors.email = "Enter a valid email address";
    if (email.length > 100) errors.email = "Email is too long";
    if (!password) errors.password = "Password is required";
    if (password.length > 128) errors.password = "Password is too long";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    clearError();
    if (!validate()) return;
    try {
      await login(email, password);
    } catch (caught: any) {
      setErr(caught.message);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", px: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
            Live System Design
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Sign in to your account
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            id="email"
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
            id="password"
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

          {(err || error) && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              {err || error}
            </Typography>
          )}

          <Button type="submit" variant="contained" fullWidth disabled={isLoading} sx={{ mt: 1 }}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 3 }}>
          Don&apos;t have an account?{" "}
          <Link to="/register" style={{ color: "#60a5fa", textDecoration: "none" }}>
            Create one
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
