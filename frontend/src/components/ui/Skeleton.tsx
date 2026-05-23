export function SkeletonLine({ width = "100%", height = 12, className = "" }: { width?: string; height?: number; className?: string }) {
  return (
    <div
      className={`bg-surface-800 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-surface-900 border border-surface-800 rounded-lg p-4 space-y-3">
      <SkeletonLine width="70%" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={`${60 + Math.random() * 30}%`} height={10} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={`${100 / cols}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel() {
  return (
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-800">
        <SkeletonLine width="40%" height={14} />
      </div>
      <div className="flex-1 p-3 space-y-3">
        <SkeletonLine width="100%" height={32} />
        <SkeletonLine width="100%" height={80} />
        <SkeletonLine width="60%" height={32} />
      </div>
    </div>
  );
}
