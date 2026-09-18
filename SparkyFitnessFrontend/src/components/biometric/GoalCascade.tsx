import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Compass,
  Target,
  CheckCircle2,
  History,
  Trash2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import type { Focus, FocusDomain } from '@/types/focus';
import { DataRow } from './DataRow';

interface GoalCascadeProps {
  domain?: FocusDomain;
  longTerm?: Focus;
  weekly?: Focus;
  dailyList: Focus[];
  onCheckIn: (focus: Focus) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenHistory: (focus: Focus) => void;
  className?: string;
}

/** Parses WOOP "[Cue: ... | If-Then: ...]" markers out of a daily focus
 * statement, same convention GoalCascadeCard used before this rewrite. */
function parseWoop(statement: string) {
  const match = statement.match(/\[(.*?)\]/);
  if (!match || !match[1]) {
    return {
      cleanStatement: statement,
      cue: null as string | null,
      ifThen: null as string | null,
    };
  }
  const cleanStatement = statement.replace(/\s*\[.*?\]/, '').trim();
  const parts = match[1].split('|').map((s) => s.trim());
  let cue: string | null = null;
  let ifThen: string | null = null;
  for (const p of parts) {
    if (p.toLowerCase().startsWith('cue:')) {
      cue = p.replace(/^cue:\s*/i, '');
    } else if (p.toLowerCase().startsWith('if-then:')) {
      ifThen = p.replace(/^if-then:\s*/i, '');
    }
  }
  return { cleanStatement, cue, ifThen };
}

/**
 * The 3-tier goal hierarchy as a single vertical rail (plan §2.4), replacing
 * GoalCascadeCard's nested bordered boxes. Tier is expressed by node
 * treatment and indent, not by another bordered container:
 * - Tier 1 (North Star Identity): filled mint node, text-base font-semibold.
 * - Tier 2 (Weekly Focus): hollow ringed node, text-sm font-medium, indented
 *   one step.
 * - Tier 3 (Daily Habits): small dot, DataRow body with its check control,
 *   indented two steps.
 *
 * Data-shape note: `FocusPage.tsx` groups focuses by domain_id + timeframe
 * into { longTerm, weekly, dailyList } rather than walking parent_focus_id —
 * this component keeps that exact same prop shape. Switching to
 * parent_focus_id is a data-model change out of scope for this restyle.
 */
export function GoalCascade({
  domain,
  longTerm,
  weekly,
  dailyList,
  onCheckIn,
  onComplete,
  onDelete,
  onOpenHistory,
  className,
}: GoalCascadeProps) {
  const { t } = useTranslation();
  const domainName =
    domain?.name || t('focus.generalDomain', 'Core Life Pillar');
  const domainColor = domain?.color || '#6366f1';

  if (!longTerm && !weekly && dailyList.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: domainColor }}
        />
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {domainName}
        </p>
      </div>

      <ol className="relative">
        {/* Tier 1 — North Star Identity */}
        {longTerm && (
          <li className="relative pb-5 pl-8 last:pb-0">
            {(weekly || dailyList.length > 0) && (
              <span
                aria-hidden
                className="absolute bottom-0 left-[7px] top-5 w-px bg-border"
              />
            )}
            <span
              aria-hidden
              className="absolute left-0 top-1 size-3.5 rounded-full bg-metric-recovery"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <Compass className="size-3.5" strokeWidth={1.5} />
                  {t('focus.tier1Header', 'North Star (Long-Term Identity)')}
                </div>
                <p className="text-base font-semibold text-foreground">
                  {longTerm.statement}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onOpenHistory(longTerm)}
                  title={t('focus.viewHistory', 'View History')}
                >
                  <History
                    className="size-3.5 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onDelete(longTerm.id)}
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2
                    className="size-3.5 text-muted-foreground hover:text-destructive"
                    strokeWidth={1.5}
                  />
                </Button>
              </div>
            </div>
          </li>
        )}

        {/* Tier 2 — Weekly Focus */}
        {weekly && (
          <li className="relative pb-5 pl-14 last:pb-0">
            {dailyList.length > 0 && (
              <span
                aria-hidden
                className="absolute bottom-0 left-[23px] top-5 w-px bg-border"
              />
            )}
            <span
              aria-hidden
              className="absolute left-4 top-1 size-3 rounded-full border-2 border-metric-recovery bg-background"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <Target className="size-3.5" strokeWidth={1.5} />
                  {t('focus.tier2Header', 'This Week’s Milestone Focus')}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {weekly.statement}
                </p>
                {weekly.target_type === 'numeric' && weekly.target_value && (
                  <span className="metric-num text-xs text-metric-recovery">
                    {t('focus.targetGoal', 'Target')}: {weekly.target_value}{' '}
                    {weekly.unit || 'units'}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onCheckIn(weekly)}
                  title={t('focus.checkIn', 'Check In')}
                >
                  <Target
                    className="size-3.5 text-metric-recovery"
                    strokeWidth={1.5}
                  />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onComplete(weekly.id)}
                  title={t('focus.markComplete', 'Mark Completed')}
                >
                  <CheckCircle2
                    className="size-3.5 text-muted-foreground hover:text-metric-recovery"
                    strokeWidth={1.5}
                  />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onDelete(weekly.id)}
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2
                    className="size-3.5 text-muted-foreground hover:text-destructive"
                    strokeWidth={1.5}
                  />
                </Button>
              </div>
            </div>
          </li>
        )}

        {/* Tier 3 — Daily Habits */}
        {dailyList.length > 0 && (
          <li className="relative pl-20">
            <span
              aria-hidden
              className="absolute left-9 top-1 size-1.5 rounded-full bg-foreground-dim"
            />
            <div className="divide-y divide-border">
              {dailyList.map((daily) => {
                const { cleanStatement, cue, ifThen } = parseWoop(
                  daily.statement
                );
                return (
                  <div key={daily.id} className="py-2 first:pt-0">
                    <DataRow
                      label={cleanStatement}
                      trailing={
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onCheckIn(daily)}
                            title={t('focus.checkIn', 'Check In')}
                          >
                            <Target
                              className="size-3.5 text-metric-recovery"
                              strokeWidth={1.5}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onComplete(daily.id)}
                            title={t('focus.markComplete', 'Mark Completed')}
                          >
                            <CheckCircle2
                              className="size-3.5 text-muted-foreground hover:text-metric-recovery"
                              strokeWidth={1.5}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onDelete(daily.id)}
                            title={t('common.delete', 'Delete')}
                          >
                            <Trash2
                              className="size-3.5 text-muted-foreground hover:text-destructive"
                              strokeWidth={1.5}
                            />
                          </Button>
                        </div>
                      }
                    />
                    {(cue || ifThen) && (
                      <div className="space-y-1 pb-1 text-[11px] text-muted-foreground">
                        {cue && (
                          <div className="flex items-start gap-1.5">
                            <Sparkles
                              className="mt-0.5 size-3 shrink-0 text-muted-foreground"
                              strokeWidth={1.5}
                            />
                            <span>
                              <strong className="text-foreground">
                                {t('focus.cueLabel', 'Cue')}:
                              </strong>{' '}
                              <span>{cue}</span>
                            </span>
                          </div>
                        )}
                        {ifThen && (
                          <div className="flex items-start gap-1.5">
                            <ShieldAlert
                              className="mt-0.5 size-3 shrink-0 text-metric-recovery"
                              strokeWidth={1.5}
                            />
                            <span>
                              <strong className="text-foreground">
                                {t('focus.ifThenLabel', 'If-Then Plan')}:
                              </strong>{' '}
                              <span>{ifThen}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

export default GoalCascade;

export type { GoalCascadeProps };
