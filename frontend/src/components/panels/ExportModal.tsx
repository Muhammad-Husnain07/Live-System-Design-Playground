import { useCallback, useState, useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import api from "../../utils/api";
import { useExportStore, EXPORT_FORMATS, NODE_COMPAT } from "../../store/exportStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import { X, Download } from "lucide-react";

loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs" } });

export default function ExportModal() {
  const {
    showModal, content, format, loading, error, filename,
    closeExport, setContent, setFormat, setLoading, setError, setFilename,
  } = useExportStore();
  const nodes = useCanvasStore((s) => s.nodes);
  const addToast = useToastStore((s) => s.addToast);
  const [generated, setGenerated] = useState(false);

  const supportedCount = nodes.filter((n) => NODE_COMPAT[n.data.nodeType] === "supported").length;
  const skippedCount = nodes.filter((n) => NODE_COMPAT[n.data.nodeType] === "skipped").length;

  const fmt = EXPORT_FORMATS.find((f) => f.value === format)!;

  const generate = useCallback(async () => {
    const pid = new URLSearchParams(window.location.search).get("projectId")
      || window.location.pathname.split("/").pop();
    if (!pid) { setError("No project ID"); return; }

    setLoading(true);
    setError(null);
    setGenerated(false);
    try {
      const res = await api.post("/export", { projectId: pid, format });
      setContent(res.data.content);
      setFilename(res.data.filename);
      setGenerated(true);
      addToast({ type: "success", title: "Export generated", duration: 3000 });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to generate export";
      setError(msg);
      addToast({ type: "error", title: "Export failed", message: msg, duration: 5000 });
    } finally {
      setLoading(false);
    }
  }, [format, addToast, setContent, setError, setFilename, setLoading]);

  useEffect(() => {
    if (showModal) generate();
  }, [showModal, format]);

  const copyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      addToast({ type: "success", title: "Copied to clipboard", duration: 2000 });
    } catch {
      addToast({ type: "error", title: "Failed to copy", duration: 3000 });
    }
  }, [content, addToast]);

  const downloadContent = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `infrastructure.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, filename, fmt.ext]);

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeExport(); }}
    >
      <div className="flex w-[90vw] max-w-6xl h-[80vh] bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden">
        <aside className="w-72 bg-surface-950 border-r border-surface-800 flex flex-col p-4 gap-3 shrink-0">
          <h2 className="text-sm font-semibold text-surface-100">Export Infrastructure</h2>

          <div className="text-[10px] text-surface-400 leading-tight">
            Generate IaC from your canvas. Only AWS resources are supported.
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">Format</span>
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={`text-left px-3 py-1.5 rounded text-[11px] transition-colors ${
                  format === f.value
                    ? "bg-green-900/30 text-green-400 border border-green-500/30"
                    : "text-surface-300 hover:bg-surface-800 hover:text-surface-100 border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              Resources ({nodes.length})
            </span>
            <div className="flex flex-col gap-0.5 text-[11px]">
              <span className="text-green-400">{supportedCount} supported</span>
              {skippedCount > 0 && <span className="text-red-400">{skippedCount} skipped</span>}
            </div>
          </div>

          {generated && (
            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={generate}
                disabled={loading}
                className="w-full px-3 py-2 rounded text-[11px] font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {loading ? "Generating..." : "Regenerate"}
              </button>
              <button
                onClick={copyContent}
                className="w-full px-3 py-2 rounded text-[11px] font-medium bg-surface-800 hover:bg-surface-700 text-surface-200 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={downloadContent}
                className="w-full px-3 py-2 rounded text-[11px] font-medium bg-surface-800 hover:bg-surface-700 text-surface-200 transition-colors"
              >
                <Download className="h-4 w-4 mr-1.5 inline-block" /> Download
              </button>
            </div>
          )}

          {!generated && loading && (
            <div className="flex items-center gap-2 mt-auto text-[11px] text-surface-400">
              <span className="w-3 h-3 border-2 border-surface-500 border-t-transparent rounded-full animate-spin" />
              Generating...
            </div>
          )}

          {error && (
            <div className="mt-auto text-[10px] text-red-400 bg-red-950/30 border border-red-500/20 rounded px-2 py-1.5">
              {error}
              <button onClick={generate} className="block mt-1 underline hover:text-red-300">Retry</button>
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-surface-800 bg-surface-950/50">
            <span className="text-[11px] text-surface-400">
              {filename || `infrastructure.${fmt.ext}`}
            </span>
            <div className="flex items-center gap-2">
              {generated && (
                <span className="text-[10px] text-green-500 bg-green-950/30 px-2 py-0.5 rounded">
                  {content.length.toLocaleString()} bytes
                </span>
              )}
              <button
                onClick={closeExport}
                className="text-surface-500 hover:text-surface-300 text-sm leading-none px-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              key={format}
              language={fmt.lang}
              theme="vs-dark"
              value={content || "// Click Generate to create infrastructure code"}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 8 },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
