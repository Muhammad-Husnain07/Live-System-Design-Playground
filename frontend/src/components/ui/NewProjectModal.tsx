import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Box from "@mui/material/Box";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string | undefined, isPublic: boolean) => Promise<void>;
}

export default function NewProjectModal({ isOpen, onClose, onSubmit }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!name.trim()) { setNameError("Project name is required"); return false; }
    if (name.trim().length < 2) { setNameError("Name must be at least 2 characters"); return false; }
    if (name.trim().length > 100) { setNameError("Name must be less than 100 characters"); return false; }
    setNameError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim(), description.trim() || undefined, isPublic);
      setName("");
      setDescription("");
      setIsPublic(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setError(null);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Project</DialogTitle>
      <DialogContent>
        {error && (
          <Typography variant="caption" sx={{ color: "error.main", mb: 1.5, display: "block", p: 1, bgcolor: "rgba(239,68,68,0.1)", borderRadius: 1, border: 1, borderColor: "rgba(239,68,68,0.3)" }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Project name"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null); }}
            placeholder="My System Design"
            fullWidth
            autoFocus
            error={!!nameError}
            helperText={nameError}
          />

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this system do?"
            multiline
            rows={3}
            fullWidth
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                sx={{ color: "primary.main", "&.Mui-checked": { color: "primary.main" } }}
              />
            }
            label={<Typography variant="body2" color="text.secondary">Make project public</Typography>}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !name.trim()}
        >
          {submitting ? "Creating..." : "Create Project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
