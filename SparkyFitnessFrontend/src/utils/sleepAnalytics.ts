import type { SleepChartData, SleepEntry, SleepStageEvent } from '@/types';

export interface SpO2DataPoint {
  date: string;
  average: number | null;
  lowest: number | null;
  highest: number | null;
}

export interface HRVDataPoint {
  date: string;
  avg_overnight_hrv: number;
}

export interface RespirationDataPoint {
  date: string;
  average: number | null;
  lowest: number | null;
  highest: number | null;
}

export interface HeartRateDataPoint {
  date: string;
  resting_heart_rate: number | null;
}

/**
 * Per-day sleep-vitals series, shared by the Reports Sleep tab
 * (SleepReport.tsx) and the Check-in "vitals HUD" (SleepVitalsHud.tsx) so
 * both reuse the exact same day-grouping/averaging rules rather than
 * re-deriving them.
 */
export function processSleepChartData(
  sleepEntries: SleepEntry[]
): SleepChartData[] {
  const grouped: Record<string, SleepEntry[]> = {};
  sleepEntries.forEach((entry) => {
    const dateKey = entry.entry_date.split('T')[0] as string;
    if (!dateKey) return;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(entry);
  });
  return Object.entries(grouped)
    .map(([date, entries]) => {
      // The earliest-bedtime session's recording zone labels the whole
      // day's hypnogram — matches processSleepData's own day-zone rule.
      const mainEntry = [...entries].sort(
        (a, b) => new Date(a.bedtime).getTime() - new Date(b.bedtime).getTime()
      )[0];
      const segments: SleepStageEvent[] = entries.flatMap((entry) =>
        (entry.stage_events ?? []).filter((ev) => ev != null)
      );
      return {
        date,
        segments,
        record_timezone: mainEntry?.record_timezone,
        record_utc_offset_minutes: mainEntry?.record_utc_offset_minutes,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function processSpO2Data(sleepEntries: SleepEntry[]): SpO2DataPoint[] {
  const grouped: Record<string, SleepEntry[]> = {};
  sleepEntries.forEach((entry) => {
    const dateKey = entry.entry_date.split('T')[0] as string;
    if (!dateKey) return;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    if (entry.average_spo2_value != null) grouped[dateKey].push(entry);
  });
  return Object.entries(grouped)
    .map(([date, entries]) => {
      const averages = entries
        .map((e) => e.average_spo2_value)
        .filter((v): v is number => v !== null);
      const lowests = entries
        .map((e) => e.lowest_spo2_value)
        .filter((v): v is number => v !== null);
      const highests = entries
        .map((e) => e.highest_spo2_value)
        .filter((v): v is number => v !== null);

      return {
        date,
        average:
          averages.length > 0
            ? averages.reduce((s, v) => s + v, 0) / averages.length
            : null,
        lowest: lowests.length > 0 ? Math.min(...lowests) : null,
        highest: highests.length > 0 ? Math.max(...highests) : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function processHRVData(sleepEntries: SleepEntry[]): HRVDataPoint[] {
  const grouped: Record<string, number[]> = {};
  sleepEntries.forEach((entry) => {
    const dateKey = entry.entry_date.split('T')[0] as string;
    if (!dateKey) return;
    if (entry.avg_overnight_hrv != null) {
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry.avg_overnight_hrv);
    }
  });
  return Object.entries(grouped)
    .map(([date, values]) => ({
      date,
      avg_overnight_hrv: values.reduce((s, v) => s + v, 0) / values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function processRespirationData(
  sleepEntries: SleepEntry[]
): RespirationDataPoint[] {
  const grouped: Record<string, SleepEntry[]> = {};
  sleepEntries.forEach((entry) => {
    const dateKey = entry.entry_date.split('T')[0] as string;
    if (!dateKey) return;
    if (entry.average_respiration_value != null) {
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    }
  });
  return Object.entries(grouped)
    .map(([date, entries]) => {
      const averages = entries
        .map((e) => e.average_respiration_value)
        .filter((v): v is number => v !== null);
      const lowests = entries
        .map((e) => e.lowest_respiration_value)
        .filter((v): v is number => v !== null);
      const highests = entries
        .map((e) => e.highest_respiration_value)
        .filter((v): v is number => v !== null);

      return {
        date,
        average:
          averages.length > 0
            ? averages.reduce((s, v) => s + v, 0) / averages.length
            : null,
        lowest: lowests.length > 0 ? Math.min(...lowests) : null,
        highest: highests.length > 0 ? Math.max(...highests) : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function processHeartRateData(
  sleepEntries: SleepEntry[]
): HeartRateDataPoint[] {
  const grouped: Record<string, number[]> = {};
  sleepEntries.forEach((entry) => {
    const dateKey = entry.entry_date.split('T')[0] as string;
    if (!dateKey) return;
    if (entry.resting_heart_rate != null) {
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry.resting_heart_rate);
    }
  });
  return Object.entries(grouped)
    .map(([date, values]) => {
      const validValues = values.filter((v): v is number => v !== null);
      return {
        date,
        resting_heart_rate:
          validValues.length > 0
            ? validValues.reduce((s, v) => s + v, 0) / validValues.length
            : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
