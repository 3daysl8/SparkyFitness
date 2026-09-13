import { tool } from 'ai';
import { addDays, todayInZone } from '@workspace/shared';
import { log } from '../../config/logging.js';
import preferenceService from '../../services/preferenceService.js';
import exerciseEntryDb from '../../models/exerciseEntry.js';
import measurementRepository from '../../models/measurementRepository.js';
import { ERRORS, formatZodError } from './errors.js';
import { normalizeDayKeywords } from './dates.js';
import { dayString, formatJsonResult } from './formatting.js';
import { getResolvedExerciseCaloriesRange } from '../../services/exerciseCalorieRangeService.js';
import { getBiometricsHistoryRows } from './checkinTools.js';
import {
  manageReportSchema,
  manageReportInput,
  dailyReportSchema,
  type ManageReportInput,
} from './schemas/report.js';

// Per-day water totals converted into the user's display unit. Previously
// lived in the now-deleted foodTools.ts (food/nutrition tracking was
// hard-deleted from this fork) — relocated here since water history isn't
// food-specific and this is its only remaining consumer.
export async function getWaterHistoryRows(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const prefs = await preferenceService.getUserPreferences(userId, userId);
  const waterUnit = (prefs?.water_display_unit as string) || 'ml';
  const rows = await measurementRepository.getWaterTotalsByDateRange(
    userId,
    startDate,
    endDate
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((row: any) => {
    const ml = Number(row.total_ml || 0);
    return {
      entry_date: dayString(row.entry_date),
      amount: waterUnit === 'oz' ? Math.round((ml / 29.5735) * 10) / 10 : ml,
      unit: waterUnit,
    };
  });
}

async function getWeeklyReport(
  userId: string,
  tz: string,
  endDate?: string
): Promise<string> {
  const end = endDate || todayInZone(tz);
  const start = addDays(end, -6);

  const water = await getWaterHistoryRows(userId, start, end);
  const bio = await getBiometricsHistoryRows(userId, start, end);

  let report = `# Weekly Performance Report (${start} to ${end})\n\n`;

  // Water
  report += '## Water Intake\n';
  if (water.length === 0) {
    report += '_No water intake logged this week._\n';
  } else {
    const wUnit = water[0]?.unit || 'ml';
    report += `| Date | Amount (${wUnit}) |\n`;
    report += '| :--- | :--- |\n';
    for (const w of water) {
      report += `| ${w.entry_date} | ${w.amount} |\n`;
    }
  }
  report += '\n';

  // Biometrics
  report += '## Biometrics Trend\n';
  if (bio.length === 0) {
    report += '_No biometric data logged this week._\n';
  } else {
    const weightUnit = bio[0]?.weight_unit || 'kg';
    report += `| Date | Weight (${weightUnit}) | BF % | Steps |\n`;
    report += '| :--- | :--- | :--- | :--- |\n';
    for (const b of bio) {
      report += `| ${b.entry_date} | ${b.weight || '-'} | ${b.body_fat_percentage || '-'} | ${b.steps || '-'} |\n`;
    }
  }

  return report;
}

// MCP's date-range defaults: a single `date` overrides start/end; otherwise
// the range defaults to today (user timezone) / the start date.
function reportDateRange(
  query: {
    date?: string;
    start_date?: string;
    end_date?: string;
  },
  tz: string
): { startDate: string; endDate: string } {
  const today = todayInZone(tz);
  const date = query.date || undefined;
  const startDate = date || query.start_date || today;
  const endDate = date || query.end_date || startDate;
  return { startDate, endDate };
}

async function getDailyReport(
  userId: string,
  tz: string,
  params: { date?: string; start_date?: string; end_date?: string }
): Promise<Record<string, unknown>> {
  const { startDate, endDate } = reportDateRange(params, tz);

  const exerciseRows = await exerciseEntryDb.getDailyExerciseTotalsRange(
    userId,
    startDate,
    endDate
  );
  // Calories come from the resolved figure, not the raw row sum: a device "Active
  // Calories" summary already contains the logged workouts beside it, so adding them
  // reports a day as ~30% more burned than the Diary shows.
  const resolvedByDate = await getResolvedExerciseCaloriesRange(
    userId,
    startDate,
    endDate
  );
  const waterRows = await measurementRepository.getWaterTotalsByDateRange(
    userId,
    startDate,
    endDate
  );

  // Projections down to MCP's per-day column sets.
  return {
    start_date: startDate,
    end_date: endDate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exercise: exerciseRows.map((r: any) => ({
      entry_date: dayString(r.entry_date),
      exercise_calories:
        resolvedByDate.get(dayString(r.entry_date))?.calories ??
        r.calories_burned,
      exercise_minutes: r.duration_minutes,
      steps: r.steps,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    water: waterRows.map((r: any) => ({
      entry_date: dayString(r.entry_date),
      water_ml: r.total_ml,
    })),
  };
}

export function buildReportTools(userId: string, tz: string) {
  return {
    sparky_get_report: tool({
      description: 'Generates consolidated health and fitness reports.',
      inputSchema: manageReportInput,
      execute: async (rawArgs) => {
        const parsed = manageReportSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        const args: ManageReportInput = parsed.data;
        try {
          switch (args.action) {
            case 'get_weekly_report': {
              return await getWeeklyReport(userId, tz, args.end_date);
            }
            default:
              return ERRORS.INVALID_ACTION(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                String((args as any).action),
                ['get_weekly_report']
              );
          }
        } catch (error) {
          log('error', '[Report Tool] Error:', error);
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_daily_report: tool({
      description:
        'Returns daily report data across exercise and water for a specific date or range.',
      inputSchema: dailyReportSchema,
      execute: async (rawArgs) => {
        const parsed = dailyReportSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const data = await getDailyReport(userId, tz, parsed.data);
          return formatJsonResult(data);
        } catch (error) {
          log('error', '[Report Tool] sparky_get_daily_report error:', error);
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Daily report',
              parsed.data.date || parsed.data.start_date || 'unknown'
            );
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
