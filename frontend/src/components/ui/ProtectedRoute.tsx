import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <Box sx={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#60a5fa" }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
