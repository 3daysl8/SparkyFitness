import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function EmptyState({
  emoji,
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  /** Decorative emoji shown above the title. Prefer `icon` (a lucide
   * component) for anything paired with the rest of this app's mostly
   * monochrome iconography; `emoji` remains supported for existing callers. */
  emoji?: string;
  icon?: ReactNode;
  title: string;
  hint?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center">
      {icon ? (
        <span aria-hidden="true">{icon}</span>
      ) : emoji ? (
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Button size="sm" variant="outline" onClick={onAction} className="mt-1">
        <Plus className="mr-1 h-3.5 w-3.5" /> {actionLabel}
      </Button>
    </div>
  );
}
