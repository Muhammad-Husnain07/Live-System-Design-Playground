import { useToastStore } from "../../store/toastStore";
import { spatialTokens } from "../../theme/spatialTokens";
import { Snackbar, Alert, Box } from "@mui/material";

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: spatialTokens.z.toast, display: "flex", flexDirection: "column-reverse", gap: 1, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <Snackbar
          key={t.id}
          open={true}
          autoHideDuration={t.duration || 4000}
          onClose={() => removeToast(t.id)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          sx={{ position: "static", transform: "none" }}
        >
          <Alert
            severity={t.type}
            variant="filled"
            onClose={() => removeToast(t.id)}
            sx={{ minWidth: 260, pointerEvents: "auto", "& .MuiAlert-message": { fontSize: "0.75rem" } }}
          >
            <Box sx={{ fontWeight: 600, fontSize: "0.75rem" }}>{t.title}</Box>
            {t.message && <Box sx={{ fontSize: "0.65rem", mt: 0.25, opacity: 0.85 }}>{t.message}</Box>}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
