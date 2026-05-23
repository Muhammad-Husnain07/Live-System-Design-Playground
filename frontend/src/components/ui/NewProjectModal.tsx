import { useState } from "react";

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 className="text-lg font-medium mb-4 text-surface-100">New Project</h3>

        {error && (
          <div className="mb-3 p-2.5 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Project name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              placeholder="My System Design"
              className={`w-full bg-surface-800 border rounded-lg px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none transition-colors ${
                nameError ? "border-red-500 focus:border-red-500" : "border-surface-700 focus:border-green-500"
              }`}
              autoFocus
            />
            {nameError && <p className="text-[10px] text-red-400 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this system do?"
              rows={3}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-green-500 transition-colors resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-green-500 w-4 h-4"
            />
            <span className="text-sm text-surface-300">Make project public</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => { onClose(); setError(null); }}
            className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
