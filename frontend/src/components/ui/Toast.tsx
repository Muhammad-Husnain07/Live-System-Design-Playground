import { useToastStore, type Toast } from "../../store/toastStore";

const TYPE_STYLES: Record<Toast["type"], { bg: string; border: string; icon: string }> = {
  success: { bg: "bg-green-950/80", border: "border-green-500/40", icon: "✓" },
  error: { bg: "bg-red-950/80", border: "border-red-500/40", icon: "✗" },
  info: { bg: "bg-blue-950/80", border: "border-blue-500/40", icon: "ℹ" },
  warning: { bg: "bg-orange-950/80", border: "border-orange-500/40", icon: "!" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const style = TYPE_STYLES[toast.type];
  return (
    <div
      className={`${style.bg} ${style.border} border rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm flex items-start gap-2 min-w-[260px] max-w-sm animate-slide-up`}
    >
      <span className="text-sm mt-0.5 shrink-0">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-surface-100 truncate">{toast.title}</p>
        {toast.message && <p className="text-[10px] text-surface-400 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-surface-500 hover:text-surface-300 text-xs shrink-0 leading-none mt-0.5"
      >
        x
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
