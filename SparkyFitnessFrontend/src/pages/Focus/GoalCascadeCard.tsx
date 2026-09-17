import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Compass,
  Target,
  CheckCircle2,
  Calendar,
  History,
  Trash2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import type { Focus, FocusDomain } from '@/types/focus';

interface GoalCascadeCardProps {
  domain?: FocusDomain;
  longTerm?: Focus;
  weekly?: Focus;
  dailyList: Focus[];
  onCheckIn: (focus: Focus) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenHistory: (focus: Focus) => void;
}

export default function GoalCascadeCard({
  domain,
  longTerm,
  weekly,
  dailyList,
  onCheckIn,
  onComplete,
  onDelete,
  onOpenHistory,
}: GoalCascadeCardProps) {
  const { t } = useTranslation();

  const domainName =
    domain?.name || t('focus.generalDomain', 'Core Life Pillar');
  const domainColor = domain?.color || '#6366f1';

  // Parse WOOP If-Then notes from daily statement if present (e.g. "[Cue: ... | If-Then: ...]")
  const parseWoop = (statement: string) => {
    const match = statement.match(/\[(.*?)\]/);
    if (!match || !match[1])
      return { cleanStatement: statement, cue: null, ifThen: null };
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
  };

  return (
    <Card className="overflow-hidden border shadow-sm transition-all hover:shadow-md">
      {/* Domain Top Bar */}
      <CardHeader className="border-b bg-muted/30 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: domainColor }}
            />
            <CardTitle className="text-sm font-semibold">
              {domainName}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-normal">
            {t('focus.cascadeBadge', '3-Tier Goal Hierarchy')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Tier 1: North Star / Long-Term Vision */}
        {longTerm && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Compass className="h-3.5 w-3.5" />
                  <span>
                    {t('focus.tier1Header', 'North Star (Long-Term Identity)')}
                  </span>
                </div>
                <p className="font-medium text-foreground text-xs leading-relaxed">
                  {longTerm.statement}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onOpenHistory(longTerm)}
                  title={t('focus.viewHistory', 'View History')}
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDelete(longTerm.id)}
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Visual Connector */}
        {(longTerm || weekly) && (
          <div className="flex items-center gap-2 pl-4 text-muted-foreground/50">
            <span className="h-4 w-0.5 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('focus.cascadesTo', 'Cascades to this week')} ➔
            </span>
          </div>
        )}

        {/* Tier 2: Weekly Focus */}
        {weekly && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 dark:bg-amber-950/10">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                  <Target className="h-3.5 w-3.5" />
                  <span>
                    {t('focus.tier2Header', 'This Week’s Milestone Focus')}
                  </span>
                </div>
                <p className="font-medium text-foreground text-xs">
                  {weekly.statement}
                </p>
                {weekly.target_type === 'numeric' && weekly.target_value && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {t('focus.targetGoal', 'Target')}: {weekly.target_value}{' '}
                      {weekly.unit || 'units'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onCheckIn(weekly)}
                  title={t('focus.checkIn', 'Check In')}
                >
                  <Target className="h-3.5 w-3.5 text-amber-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onComplete(weekly.id)}
                  title={t('focus.markComplete', 'Mark Completed')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDelete(weekly.id)}
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Visual Connector */}
        {dailyList.length > 0 && (
          <div className="flex items-center gap-2 pl-4 text-muted-foreground/50">
            <span className="h-4 w-0.5 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('focus.anchoredDaily', 'Anchored in daily habits & WOOP plan')}{' '}
              ➔
            </span>
          </div>
        )}

        {/* Tier 3: Daily Habits & WOOP */}
        {dailyList.length > 0 && (
          <div className="space-y-2">
            {dailyList.map((daily) => {
              const { cleanStatement, cue, ifThen } = parseWoop(
                daily.statement
              );
              return (
                <div
                  key={daily.id}
                  className="rounded-lg border bg-card p-3 transition-colors hover:border-border/80 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {t('focus.tier3Header', 'Daily Implementation Habit')}
                        </span>
                      </div>
                      <p className="font-medium text-foreground text-xs">
                        {cleanStatement}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onCheckIn(daily)}
                        title={t('focus.checkIn', 'Check In')}
                      >
                        <Target className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onComplete(daily.id)}
                        title={t('focus.markComplete', 'Mark Completed')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => onDelete(daily.id)}
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* WOOP Cues & If-Then Plan */}
                  {(cue || ifThen) && (
                    <div className="grid gap-1.5 rounded bg-muted/40 p-2 text-[11px]">
                      {cue && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Sparkles className="h-3 w-3 text-primary shrink-0" />
                          <span>
                            <strong className="text-foreground">
                              {t('focus.cueLabel', 'Cue')}:
                            </strong>{' '}
                            {cue}
                          </span>
                        </div>
                      )}
                      {ifThen && (
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                          <ShieldAlert className="h-3 w-3 shrink-0" />
                          <span>
                            <strong>
                              {t('focus.ifThenLabel', 'If-Then Plan')}:
                            </strong>{' '}
                            {ifThen}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
