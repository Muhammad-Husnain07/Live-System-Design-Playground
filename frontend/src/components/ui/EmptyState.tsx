import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mb-3">
          <span className="text-surface-500 text-lg">{icon}</span>
        </div>
      )}
      <p className="text-sm text-surface-400 mb-1">{title}</p>
      {description && <p className="text-[11px] text-surface-600 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
