import { useTranslation } from 'react-i18next';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useDailyHealthMetrics } from '@/hooks/useGenericHealth';
import { SectionCard } from '@/components/biometric/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { DailyHealthMetricsCard } from '@/components/Health/DailyHealthMetricsCard';

export default function WearableHealthCard({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();

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
    <SectionCard
      title={t('dailyHealthMetrics.title', 'Daily Wearable Health Summary')}
      icon={Activity}
      badge={
        metrics?.source_provider && (
          <Badge variant="secondary" className="shrink-0 capitalize">
            {metrics.source_provider}
          </Badge>
        )
      }
      loading={isLoading}
    >
      <DailyHealthMetricsCard metrics={metrics} isLoading={isLoading} />
    </SectionCard>
  );
}
