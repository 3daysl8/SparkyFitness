import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SectionCardProps {
  title: ReactNode;
  icon?: LucideIcon;
  /** Small pill/count rendered beside the title (e.g. a completion badge). */
  badge?: ReactNode;
  /** Secondary line under the title. */
  summary?: ReactNode;
  /** Extra header control rendered before the chevron (e.g. an Add button or
   * a Day/Week toggle). Must call `e.stopPropagation()` itself if it's
   * interactive, since the whole header is the collapse trigger. */
  action?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
  /** Rows to render as Skeleton placeholders while `loading` is true. */
  loadingRows?: number;
  className?: string;
  children?: ReactNode;
}

/**
 * The single Home/dashboard card shell — collapsible header, one Card
 * boundary, flat body. Replaces the `Collapsible > Card > CardHeader
 * (trigger) > CollapsibleContent > CardContent` skeleton that used to be
 * hand-copied across AgendaCard, ToDoCard, HabitCard, SupplementsSnapshotCard,
 * DailyCheckpointCard and WearableHealthCard. Callers no longer have access
 * to a `Card` of their own, which is what makes "one card boundary per
 * region" enforceable rather than aspirational.
 */
export function SectionCard({
  title,
  icon: Icon,
  badge,
  summary,
  action,
  defaultOpen = true,
  open,
  onOpenChange,
  loading,
  loadingRows = 3,
  className,
  children,
}: SectionCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className={className}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between gap-2 pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {Icon && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={1.5} />
                </span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate">{title}</CardTitle>
                  {badge}
                </div>
                {summary && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {summary}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {action}
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
                strokeWidth={1.5}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: loadingRows }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              children
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default SectionCard;
