import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToastStore } from "../../store/toastStore";
import api from "../../utils/api";
import { X, FileText, Upload, AlertTriangle } from "lucide-react";

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
      const msg = err?.response?.data?.error ?? err.message ?? "Import failed";
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="flex flex-col w-[90vw] max-w-lg max-h-[85vh] bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-800 shrink-0">
          <h2 className="text-sm font-medium text-surface-100">Import Infrastructure</h2>
          <button
            onClick={handleClose}
            className="text-surface-500 hover:text-surface-300 transition-colors text-sm px-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-[11px] text-surface-400 leading-relaxed">
            Import an existing infrastructure-as-code file to create a new project with an auto-generated canvas.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-blue-400 bg-blue-500/10"
                : file
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-surface-600 hover:border-surface-500 bg-surface-950/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptedExtensions}
              onChange={handleInputChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-1">
                <FileText className="h-8 w-8 text-blue-400" />
                <p className="text-sm font-medium text-surface-200">{file.name}</p>
                <p className="text-[10px] text-surface-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="text-[10px] text-red-400 hover:text-red-300 underline mt-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-surface-400" />
                <p className="text-sm text-surface-300">
                  Drop your IaC file here
                </p>
                <p className="text-[10px] text-surface-500">
                  or click to browse
                </p>
                <div className="flex gap-2 justify-center text-[9px] text-surface-500 mt-2">
                  <span className="bg-surface-800 px-1.5 py-0.5 rounded">.tf</span>
                  <span className="bg-surface-800 px-1.5 py-0.5 rounded">.yaml</span>
                  <span className="bg-surface-800 px-1.5 py-0.5 rounded">.json</span>
                </div>
              </div>
            )}
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-[10px] text-surface-500 uppercase tracking-wider font-medium mb-1.5">
              Format {format && <span className="text-green-400 lowercase normal-case">(auto-detected)</span>}
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-surface-800 text-surface-200 text-[11px] px-2.5 py-2 rounded-lg border border-surface-700 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Select format...</option>
              {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium text-red-400">Import failed</p>
                  <p className="text-[9px] text-red-400/70 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-blue-400">
                    {phase === "uploading" && "Uploading file..."}
                    {phase === "parsing" && "Parsing infrastructure..."}
                    {phase === "creating" && "Creating project..."}
                  </p>
                  <p className="text-[9px] text-blue-400/60 mt-0.5">
                    {file?.name}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-800 shrink-0">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-3 py-1.5 text-[11px] text-surface-400 hover:text-surface-200 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !file || !format}
            className="px-4 py-1.5 text-[11px] font-medium rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? "Importing..." : "Import & Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
