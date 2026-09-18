import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useDailyHealthMetrics } from '@/hooks/useGenericHealth';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { DailyHealthMetricsCard } from '@/components/Health/DailyHealthMetricsCard';

export default function WearableHealthCard({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();
  const [isOpen, setIsOpen] = useState(true);

  const { data, isLoading } = useDailyHealthMetrics(
    selectedDate,
    selectedDate,
    activeUserId ?? undefined
  );
  const metrics = data?.[0];

  // No wearable synced anything for this date (or no wearable connected at
  // all) -- stay invisible, same as SupplementsSnapshotCard when the cabinet
  // is empty, rather than showing an all-dashes card forever.
  if (!isLoading && !metrics) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-teal-500/20 bg-gradient-to-br from-teal-50/20 via-card to-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex cursor-pointer flex-row items-center justify-between p-4 pb-3">
            <CardTitle className="text-base font-semibold tracking-tight">
              {t('dailyHealthMetrics.title', 'Daily Wearable Health Summary')}
            </CardTitle>
            <div className="flex items-center gap-2">
              {metrics?.source_provider && (
                <Badge variant="secondary" className="capitalize shrink-0">
                  {metrics.source_provider}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-0">
            <DailyHealthMetricsCard metrics={metrics} isLoading={isLoading} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
