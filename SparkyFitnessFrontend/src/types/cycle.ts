export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type CycleFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

export type CycleSymptom =
  | 'cramps'
  | 'bloating'
  | 'headache'
  | 'fatigue'
  | 'breast_tenderness'
  | 'acne'
  | 'mood_swings'
  | 'cravings'
  | 'backache'
  | 'insomnia';

export interface CycleSettings {
  enabled: boolean;
  avg_cycle_length: number; // typically 28 (range 21 - 45)
  avg_period_length: number; // typically 5 (range 2 - 10)
  luteal_phase_length: number; // typically 14
  last_period_start_date: string; // YYYY-MM-DD
  reminders_enabled: boolean;
}

export interface CycleDailyEntry {
  id?: string;
  date: string; // YYYY-MM-DD
  flow: CycleFlow | null;
  symptoms: CycleSymptom[];
  energy: number; // 1 - 5
  notes?: string;
  updated_at?: string;
}

export interface CycleHistoryItem {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  period_length: number;
  cycle_length?: number | null;
}

export interface CyclePhaseInfo {
  phase: CyclePhase;
  phaseName: string;
  cycleDay: number;
  totalCycleDays: number;
  daysUntilNextPeriod: number;
  phaseProgressPercent: number;
  nextPeriodDate: string;
  ovulationDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  trainingGuidance: {
    title: string;
    focus: string;
    intensity: 'high' | 'moderate' | 'low' | 'recovery';
    description: string;
  };
  nutritionGuidance: {
    title: string;
    tip: string;
    metabolicNote?: string;
  };
}
