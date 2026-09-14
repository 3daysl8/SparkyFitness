import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function EmptyState({
  emoji,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  hint?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center">
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Button size="sm" variant="outline" onClick={onAction} className="mt-1">
        <Plus className="mr-1 h-3.5 w-3.5" /> {actionLabel}
      </Button>
    </div>
  );
}
