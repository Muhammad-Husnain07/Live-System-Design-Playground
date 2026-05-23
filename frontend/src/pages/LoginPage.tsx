import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

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
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-100">
            Live System Design
          </h1>
          <p className="text-surface-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-surface-300 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
              className={`w-full px-3 py-2 bg-surface-800 border rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-1 text-sm ${
                fieldErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-surface-700 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="you@example.com"
            />
            {fieldErrors.email && <p className="text-[10px] text-red-400 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm text-surface-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
              className={`w-full px-3 py-2 bg-surface-800 border rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-1 text-sm ${
                fieldErrors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-surface-700 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="••••••••"
            />
            {fieldErrors.password && <p className="text-[10px] text-red-400 mt-1">{fieldErrors.password}</p>}
          </div>

          {(err || error) && (
            <p className="text-red-400 text-sm">{err || error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-surface-400 text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
