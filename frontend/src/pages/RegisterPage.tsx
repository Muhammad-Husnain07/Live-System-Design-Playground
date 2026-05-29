import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): string | null => {
    if (!email.includes("@")) return "Invalid email address";
    if (username.length < 3 || username.length > 20) return "Username must be 3–20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username: letters, numbers, underscores only";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirm) return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    clearError();
    const validationErr = validate();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
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
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <TextField
            id="reg-username"
            label="Username"
            required
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="myuser"
          />

          <TextField
            id="reg-password"
            label="Password"
            type="password"
            required
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <TextField
            id="reg-confirm"
            label="Confirm password"
            type="password"
            required
            fullWidth
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
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
