import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Compass, ChevronRight, Target, Sparkles } from 'lucide-react';
import { useTodayFocusSnapshot, useFocusDomains } from '@/hooks/useFocus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function FocusBanner({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: snapshot } = useTodayFocusSnapshot(selectedDate);
  const { data: domains = [] } = useFocusDomains();

  const domainMap = useMemo(() => {
    return new Map(domains.map((d) => [d.id, d]));
  }, [domains]);

  const weeklyFocuses = snapshot?.weekly ?? [];
  const primaryWeeklyFocus = weeklyFocuses[0] ?? null;

  const weeklyDomain = primaryWeeklyFocus?.domain_id
    ? domainMap.get(primaryWeeklyFocus.domain_id)
    : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <Compass className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{t('focus.focusAndGoals', 'Weekly Focus & Goals')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/focus')}
        >
          <span>{t('focus.manageVision', 'Vision & Pillars')}</span>
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {primaryWeeklyFocus ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
          <Target
            className="mt-0.5 h-4 w-4 shrink-0 text-metric-recovery"
            strokeWidth={1.5}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-snug text-foreground">
              {primaryWeeklyFocus.statement}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {weeklyDomain && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-normal px-1.5 py-0 h-4.5"
                  style={
                    weeklyDomain.color
                      ? {
                          borderColor: weeklyDomain.color,
                          color: weeklyDomain.color,
                        }
                      : undefined
                  }
                >
                  {weeklyDomain.name}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                {t('focus.thisWeeksAnchor', 'This week’s anchor')}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-2.5">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.5}
            />
            <span className="text-xs text-muted-foreground">
              {t('focus.noWeeklyFocusSet', 'No weekly focus set for this week')}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate('/focus')}
          >
            {t('focus.setWeeklyFocus', 'Set Focus')}
          </Button>
        </div>
      )}

      {domains.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
            {t('focus.pillars', 'Pillars')}:
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {domains.map((dom) => (
              <Badge
                key={dom.id}
                variant="outline"
                className="text-[10px] h-4.5 px-1.5 font-normal"
                style={
                  dom.color
                    ? {
                        borderColor: `${dom.color}40`,
                        backgroundColor: `${dom.color}10`,
                      }
                    : undefined
                }
              >
                <span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: dom.color ?? 'var(--primary)',
                  }}
                />
                {dom.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
