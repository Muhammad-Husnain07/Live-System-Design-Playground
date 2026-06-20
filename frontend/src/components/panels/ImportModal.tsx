import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToastStore } from "../../store/toastStore";
import api, { getErrorMessage } from "../../utils/api";
import { X, FileText, Upload, AlertTriangle } from "lucide-react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Button, Typography, Select, MenuItem } from "@mui/material";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXTENSION_MAP: Record<string, string> = {
  ".tf": "terraform",
  ".tf.json": "terraform",
  ".yaml": "kubernetes",
  ".yml": "kubernetes",
  ".json": "cloudformation",
};

const FORMAT_LABELS: Record<string, string> = {
  terraform: "Terraform (.tf)",
  kubernetes: "Kubernetes (.yaml)",
  cloudformation: "CloudFormation (.json)",
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading" | "parsing" | "creating">("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const detectFormat = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".tf.json")) return EXTENSION_MAP[".tf.json"];
    if (lower.endsWith(".tf")) return EXTENSION_MAP[".tf"];
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return EXTENSION_MAP[".yaml"];
    if (lower.endsWith(".json")) return EXTENSION_MAP[".json"];
    return "";
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    const detected = detectFormat(f.name);
    if (detected) {
      setFormat(detected);
    } else {
      setFormat("");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!file || !format) return;
    setLoading(true);
    setError(null);

    try {
      setPhase("uploading");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);

      setPhase("parsing");
      const res = await api.post("/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      setPhase("creating");
      const project = res.data.project;
      addToast({
        type: "success",
        title: "Project imported",
        message: `Imported ${file.name} — ${project.canvas_data?.nodes?.length ?? 0} resources`,
        duration: 5000,
      });
      onClose();
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      const msg = getErrorMessage(err, "Import failed.");
      setError(msg);
      addToast({ type: "error", title: "Import failed", message: msg, duration: 8000 });
    } finally {
      setLoading(false);
      setPhase("");
    }
  }, [file, format, addToast, navigate, onClose]);

  const reset = useCallback(() => {
    setFile(null);
    setFormat("");
    setError(null);
    setDragOver(false);
    setPhase("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const acceptedExtensions = ".tf,.tf.json,.yaml,.yml,.json";

  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "12px",
            maxHeight: "85vh",
          },
        },
        backdrop: {
          sx: {
            bgcolor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.75,
          borderBottom: "1px solid #27272a",
          color: "#f4f4f5",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        Import Infrastructure
        <Box
          component="button"
          onClick={handleClose}
          sx={{
            display: "flex",
            alignItems: "center",
            p: 0.25,
            border: "none",
            bgcolor: "transparent",
            color: "#71717a",
            cursor: "pointer",
            transition: "color 0.2s",
            "&:hover": { color: "#a1a1aa" },
          }}
        >
          <X size={16} />
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2.5,
          "& > :not(:last-child)": { mb: 2 },
        }}
      >
        <Typography sx={{ fontSize: "11px", lineHeight: 1.625, color: "#a1a1aa" }}>
          Import an existing infrastructure-as-code file to create a new project with an auto-generated canvas.
        </Typography>

        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderRadius: "12px",
            p: 4,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            borderColor: dragOver ? "#60a5fa" : file ? "rgba(34,197,94,0.5)" : "#52525b",
            bgcolor: dragOver ? "rgba(59,130,246,0.1)" : file ? "rgba(34,197,94,0.05)" : "rgba(24,24,27,0.5)",
            ...(!dragOver && !file
              ? { "&:hover": { borderColor: "#71717a" } }
              : {}),
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptedExtensions}
            onChange={handleInputChange}
            style={{ display: "none" }}
          />

          {file ? (
            <Box>
              <FileText size={32} style={{ color: "#60a5fa" }} />
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#f4f4f5", mt: 0.5 }}>
                {file.name}
              </Typography>
              <Typography sx={{ fontSize: "10px", color: "#71717a" }}>
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
              <Button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                sx={{
                  fontSize: "10px",
                  color: "#ef4444",
                  textDecoration: "underline",
                  textTransform: "none",
                  minWidth: 0,
                  p: 0,
                  mt: 0.5,
                  bgcolor: "transparent",
                  "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                }}
              >
                Remove
              </Button>
            </Box>
          ) : (
            <Box>
              <Upload size={32} style={{ color: "#a1a1aa" }} />
              <Typography sx={{ fontSize: "0.875rem", color: "#a1a1aa", mt: 0.5 }}>
                Drop your IaC file here
              </Typography>
              <Typography sx={{ fontSize: "10px", color: "#71717a" }}>
                or click to browse
              </Typography>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 1 }}>
                {[".tf", ".yaml", ".json"].map((ext) => (
                  <Typography
                    key={ext}
                    sx={{
                      fontSize: "9px",
                      color: "#71717a",
                      bgcolor: "#27272a",
                      px: 0.75,
                      py: 0.25,
                      borderRadius: "4px",
                    }}
                  >
                    {ext}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Box>
          <Typography
            sx={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 500,
              mb: 0.75,
              color: "#71717a",
            }}
          >
            Format{" "}
            {format && (
              <Typography
                component="span"
                sx={{ fontSize: "10px", textTransform: "none", color: "#22c55e" }}
              >
                (auto-detected)
              </Typography>
            )}
          </Typography>
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            fullWidth
            displayEmpty
            sx={{
              bgcolor: "#27272a",
              color: "#f4f4f5",
              fontSize: "11px",
              borderRadius: "8px",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3f3f46" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6", borderWidth: 1 },
              "& .MuiSelect-icon": { color: "#f4f4f5" },
              "& .MuiSelect-select": { py: 0.75, px: 1.25 },
            }}
          >
            <MenuItem value="">
              <em style={{ color: "#a1a1aa" }}>Select format...</em>
            </MenuItem>
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </Box>

        {error && (
          <Box
            sx={{
              bgcolor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              px: 1.5,
              py: 1.25,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: "10px", fontWeight: 500, color: "#ef4444" }}>
                  Import failed
                </Typography>
                <Typography sx={{ fontSize: "9px", mt: 0.25, color: "rgba(239,68,68,0.7)" }}>
                  {error}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {loading && (
          <Box
            sx={{
              bgcolor: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: "8px",
              px: 1.5,
              py: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  border: "2px solid #60a5fa",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  flexShrink: 0,
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
              <Box>
                <Typography sx={{ fontSize: "11px", fontWeight: 500, color: "#60a5fa" }}>
                  {phase === "uploading" && "Uploading file..."}
                  {phase === "parsing" && "Parsing infrastructure..."}
                  {phase === "creating" && "Creating project..."}
                </Typography>
                <Typography sx={{ fontSize: "9px", mt: 0.25, color: "rgba(96,165,250,0.6)" }}>
                  {file?.name}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1,
          px: 2.5,
          py: 1.5,
          borderTop: "1px solid #27272a",
        }}
      >
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: "#a1a1aa",
            fontSize: "11px",
            textTransform: "none",
            px: 1.5,
            py: 0.75,
            minWidth: 0,
            bgcolor: "transparent",
            "&:hover": { bgcolor: "transparent", color: "#f4f4f5" },
            "&:disabled": { opacity: 0.4 },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={loading || !file || !format}
          sx={{
            fontSize: "11px",
            fontWeight: 500,
            textTransform: "none",
            px: 2,
            py: 0.75,
            borderRadius: "8px",
            bgcolor: "#16a34a",
            color: "#ffffff",
            "&:hover": { bgcolor: "#22c55e" },
            "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
          }}
        >
          {loading ? "Importing..." : "Import & Create Project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
