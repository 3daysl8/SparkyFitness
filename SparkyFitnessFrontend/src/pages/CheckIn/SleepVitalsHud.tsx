import { useMemo } from 'react';
import { addDays } from '@workspace/shared';
import { useSleepEntriesQuery } from '@/hooks/CheckIn/useSleep';
import {
  processHRVData,
  processHeartRateData,
  processRespirationData,
  processSleepChartData,
  processSpO2Data,
} from '@/utils/sleepAnalytics';
import HRVCard from '../Reports/HRVCard';
import SpO2Card from '../Reports/SpO2Card';
import SleepRespirationCard from '../Reports/SleepRespirationCard';
import SleepHeartRateCard from '../Reports/SleepHeartRateCard';
import SleepSummaryCard from '../Reports/SleepSummaryCard';
import SleepStageChart from '../Reports/SleepStageChart';

const TREND_WINDOW_DAYS = 14;

interface SleepVitalsHudProps {
  selectedDate: string;
}

/**
 * Composes the same sleep-vitals cards Reports already builds (HRV, SpO2,
 * respiration, resting HR, hypnogram, nightly summary) around `selectedDate`
 * instead of an arbitrary report range — surfacing them on Check-in rather
 * than leaving them two levels deep under Reports > Sleep. Pure composition:
 * each card is still the exact Reports component, self-guarding against
 * empty data the same way it already does there.
 */
export default function SleepVitalsHud({ selectedDate }: SleepVitalsHudProps) {
  const windowStart = useMemo(
    () => addDays(selectedDate, -(TREND_WINDOW_DAYS - 1)),
    [selectedDate]
  );
  const { data: sleepEntries = [] } = useSleepEntriesQuery(
    windowStart,
    selectedDate
  );

  const todaysEntries = useMemo(
    () =>
      sleepEntries.filter(
        (entry) => entry.entry_date.split('T')[0] === selectedDate
      ),
    [sleepEntries, selectedDate]
  );
  // Multiple sessions can share a day (naps included) — the longest one is
  // the best stand-in for "last night" in a single summary tile.
  const mainEntry = useMemo(
    () =>
      todaysEntries.length === 0
        ? null
        : [...todaysEntries].sort(
            (a, b) => b.duration_in_seconds - a.duration_in_seconds
          )[0]!,
    [todaysEntries]
  );

  const sleepChartDataForDay = useMemo(() => {
    const byDate = processSleepChartData(sleepEntries);
    return (
      byDate.find((d) => d.date === selectedDate) ?? {
        date: selectedDate,
        segments: [],
      }
    );
  }, [sleepEntries, selectedDate]);

  if (sleepEntries.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <SleepSummaryCard latestSleepEntry={mainEntry} />
      </div>
      <div className="md:col-span-2">
        <SleepStageChart sleepChartData={sleepChartDataForDay} />
      </div>
      <HRVCard data={processHRVData(sleepEntries)} />
      <SpO2Card data={processSpO2Data(sleepEntries)} />
      <SleepRespirationCard data={processRespirationData(sleepEntries)} />
      <SleepHeartRateCard data={processHeartRateData(sleepEntries)} />
    </div>
  );
}
