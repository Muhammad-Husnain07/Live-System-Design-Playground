import { Component, type ReactNode } from "react";
import { Box, Typography, Button } from "@mui/material";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
          <Box sx={{ bgcolor: "#27272a", border: 1, borderColor: "#3f3f46", borderRadius: 3, p: 3, maxWidth: 448, width: "100%", textAlign: "center" }}>
            <Box sx={{ width: 48, height: 48, mx: "auto", mb: 2, borderRadius: "50%", bgcolor: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ fontSize: "1.125rem", color: "#ef4444", fontWeight: 700 }}>!</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, mb: 0.5, color: "#f4f4f5" }}>Something went wrong</Typography>
            <Typography sx={{ fontSize: "0.6875rem", mb: 2, lineHeight: 1.625, color: "#71717a" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </Typography>
            <Button size="small" onClick={this.handleReset} sx={{ color: "#60a5fa", bgcolor: "rgba(59,130,246,0.2)", "&:hover": { bgcolor: "rgba(59,130,246,0.3)" } }}>
              Try Again
            </Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}
