import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mb-3">
          <span className="text-lg" style={{ color: '#71717a' }}>{icon}</span>
        </div>
      )}
      <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>{title}</p>
      {description && <p className="text-[11px] mb-4 max-w-xs" style={{ color: '#52525b' }}>{description}</p>}
      {action}
    </div>
  );
}
