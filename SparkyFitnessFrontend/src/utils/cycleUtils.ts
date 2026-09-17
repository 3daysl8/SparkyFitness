import {
  CyclePhase,
  CycleSettings,
  CycleDailyEntry,
  CyclePhaseInfo,
  CycleHistoryItem,
} from '@/types/cycle';

export const STORAGE_KEY_CYCLE_SETTINGS = 'sparky_cycle_settings';
export const STORAGE_KEY_CYCLE_ENTRIES = 'sparky_cycle_entries';
export const STORAGE_KEY_CYCLE_HISTORY = 'sparky_cycle_history';

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  enabled: true,
  avg_cycle_length: 28,
  avg_period_length: 5,
  luteal_phase_length: 14,
  last_period_start_date:
    new Date().toISOString().split('T')[0] || '2026-09-01',
  reminders_enabled: true,
};

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add days to a YYYY-MM-DD string and return YYYY-MM-DD
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return formatDateYMD(date);
}

/**
 * Calculate difference in days between two YYYY-MM-DD strings (b - a)
 */
export function daysDifference(
  startDateStr: string,
  targetDateStr: string
): number {
  const [y1, m1, d1] = startDateStr.split('-').map(Number);
  const [y2, m2, d2] = targetDateStr.split('-').map(Number);
  const date1 = new Date(y1 ?? 2026, (m1 ?? 1) - 1, d1 ?? 1);
  const date2 = new Date(y2 ?? 2026, (m2 ?? 1) - 1, d2 ?? 1);
  const diffTime = date2.getTime() - date1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Compute the 1-based cycle day given the start of the current cycle.
 */
export function calculateCycleDay(
  lastPeriodStart: string,
  currentDate: string,
  avgCycleLength: number
): { cycleDay: number; cycleStartDate: string } {
  const diff = daysDifference(lastPeriodStart, currentDate);
  const cycleLen = Math.max(21, Math.min(45, avgCycleLength || 28));

  if (diff < 0) {
    return { cycleDay: 1, cycleStartDate: currentDate };
  }

  const completedCycles = Math.floor(diff / cycleLen);
  const dayInCycle = (diff % cycleLen) + 1;
  const currentCycleStart = addDaysToDateStr(
    lastPeriodStart,
    completedCycles * cycleLen
  );

  return { cycleDay: dayInCycle, cycleStartDate: currentCycleStart };
}

/**
 * Determine the cycle phase based on cycle day and configuration.
 */
export function determineCyclePhase(
  cycleDay: number,
  avgCycleLength: number = 28,
  avgPeriodLength: number = 5,
  lutealLength: number = 14
): CyclePhase {
  const cycleLen = Math.max(21, Math.min(45, avgCycleLength));
  const periodLen = Math.max(2, Math.min(10, avgPeriodLength));
  const ovulationDay = Math.max(periodLen + 2, cycleLen - lutealLength);

  if (cycleDay <= periodLen) {
    return 'menstrual';
  } else if (cycleDay < ovulationDay - 1) {
    return 'follicular';
  } else if (cycleDay <= ovulationDay + 1) {
    return 'ovulatory';
  } else {
    return 'luteal';
  }
}

/**
 * Detailed training & nutrition recommendations per cycle phase.
 */
export function getPhaseRecommendations(phase: CyclePhase): {
  phaseName: string;
  trainingGuidance: CyclePhaseInfo['trainingGuidance'];
  nutritionGuidance: CyclePhaseInfo['nutritionGuidance'];
} {
  switch (phase) {
    case 'menstrual':
      return {
        phaseName: 'Menstrual Phase',
        trainingGuidance: {
          title: 'Recovery & Gentle Mobility',
          focus: 'Low-impact movement, light weights, yoga, and walking.',
          intensity: 'recovery',
          description:
            'Estrogen and progesterone are at baseline. Prioritize rest and active recovery if fatigue or cramps occur. Listen to your body and scale back intensity when needed.',
        },
        nutritionGuidance: {
          title: 'Replenish & Restore',
          tip: 'Emphasize iron-rich foods (lean meats, spinach, legumes), magnesium (dark chocolate, pumpkin seeds), and warm herbal teas for cramp relief.',
          metabolicNote:
            'Baseline metabolic rate. Focus on steady hydration and anti-inflammatory whole foods.',
        },
      };

    case 'follicular':
      return {
        phaseName: 'Follicular Phase',
        trainingGuidance: {
          title: 'High Energy & Progressive Overload',
          focus: 'Heavy resistance training, HIIT, sprints, and skill work.',
          intensity: 'high',
          description:
            'Rising estrogen increases pain tolerance, muscle recovery rate, and insulin sensitivity. Prime phase to push personal records and increase volume.',
        },
        nutritionGuidance: {
          title: 'Fuel Muscle Building',
          tip: 'Incorporate complex carbohydrates around workouts (oats, sweet potatoes, quinoa) and lean proteins to support optimal muscle protein synthesis.',
          metabolicNote:
            'Higher carbohydrate efficiency and enhanced glycogen storage.',
        },
      };

    case 'ovulatory':
      return {
        phaseName: 'Ovulatory Phase',
        trainingGuidance: {
          title: 'Peak Power & Maximum Effort',
          focus:
            'Max strength lifts, explosive power, and high-intensity output.',
          intensity: 'high',
          description:
            'Peak estrogen and a surge in luteinizing hormone promote maximum energy and confidence. Ensure thorough warm-ups as joint laxity can be slightly higher.',
        },
        nutritionGuidance: {
          title: 'Antioxidants & Fiber',
          tip: 'Support estrogen metabolism with cruciferous vegetables (broccoli, Brussels sprouts), leafy greens, berries, and plenty of water.',
          metabolicNote: 'Highest basal energy output and vitality.',
        },
      };

    case 'luteal':
      return {
        phaseName: 'Luteal Phase',
        trainingGuidance: {
          title: 'Endurance & Strength Maintenance',
          focus:
            'Steady-state cardio, moderate resistance training, and Pilates.',
          intensity: 'moderate',
          description:
            'Progesterone rises, elevating body temperature and resting heart rate. Perceived exertion is higher. Focus on consistent pacing and allow extra recovery between sets.',
        },
        nutritionGuidance: {
          title: 'Support PMS & Satiety',
          tip: 'Increase healthy fats (avocados, nuts, salmon) and complex slow-digesting carbs. Supplement with vitamin B6 and magnesium to curb cravings.',
          metabolicNote:
            'Metabolic rate increases by +100 to 300 kcal/day. Prioritize satiety and hydration.',
        },
      };
  }
}

/**
 * Generate full cycle phase information for a given date.
 */
export function calculateCycleInfo(
  currentDate: string,
  settings: CycleSettings = DEFAULT_CYCLE_SETTINGS
): CyclePhaseInfo {
  const cycleLen = Math.max(21, Math.min(45, settings.avg_cycle_length || 28));
  const periodLen = Math.max(2, Math.min(10, settings.avg_period_length || 5));
  const lutealLen = settings.luteal_phase_length || 14;

  const { cycleDay, cycleStartDate } = calculateCycleDay(
    settings.last_period_start_date,
    currentDate,
    cycleLen
  );

  const phase = determineCyclePhase(cycleDay, cycleLen, periodLen, lutealLen);
  const { phaseName, trainingGuidance, nutritionGuidance } =
    getPhaseRecommendations(phase);

  const ovulationDay = Math.max(periodLen + 2, cycleLen - lutealLen);
  const ovulationDate = addDaysToDateStr(cycleStartDate, ovulationDay - 1);
  const fertileWindowStart = addDaysToDateStr(cycleStartDate, ovulationDay - 5);
  const fertileWindowEnd = addDaysToDateStr(cycleStartDate, ovulationDay);
  const nextPeriodDate = addDaysToDateStr(cycleStartDate, cycleLen);
  const daysUntilNextPeriod = Math.max(
    0,
    daysDifference(currentDate, nextPeriodDate)
  );
  const phaseProgressPercent = Math.min(
    100,
    Math.round((cycleDay / cycleLen) * 100)
  );

  return {
    phase,
    phaseName,
    cycleDay,
    totalCycleDays: cycleLen,
    daysUntilNextPeriod,
    phaseProgressPercent,
    nextPeriodDate,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    trainingGuidance,
    nutritionGuidance,
  };
}

// --- Local Storage Helpers ---

export function getStoredCycleSettings(): CycleSettings {
  if (typeof window === 'undefined') return DEFAULT_CYCLE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CYCLE_SETTINGS);
    if (!raw) return DEFAULT_CYCLE_SETTINGS;
    return { ...DEFAULT_CYCLE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CYCLE_SETTINGS;
  }
}

export function saveStoredCycleSettings(
  settings: Partial<CycleSettings>
): CycleSettings {
  const current = getStoredCycleSettings();
  const next: CycleSettings = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CYCLE_SETTINGS, JSON.stringify(next));
    } catch {
      // localStorage restricted
    }
  }
  return next;
}

export function getStoredCycleEntries(): Record<string, CycleDailyEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CYCLE_ENTRIES);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveStoredCycleEntry(
  entry: CycleDailyEntry
): Record<string, CycleDailyEntry> {
  const entries = getStoredCycleEntries();
  entries[entry.date] = entry;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CYCLE_ENTRIES, JSON.stringify(entries));
    } catch {
      // localStorage restricted
    }
  }
  return entries;
}

export function getStoredCycleHistory(): CycleHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CYCLE_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredCycleHistory(history: CycleHistoryItem[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_CYCLE_HISTORY, JSON.stringify(history));
    } catch {
      // localStorage restricted
    }
  }
}
