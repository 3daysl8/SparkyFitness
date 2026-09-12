// Shared types for the Focus & Motivation module. Kept in src/types so both
// the api service (src/api) and page components can import them (page
// components are not allowed to import from src/api directly).

export type FocusTimeframe = 'daily' | 'weekly' | 'long_term';
export type FocusTargetType = 'none' | 'numeric' | 'boolean';
export type FocusStatus = 'active' | 'completed' | 'archived';

export interface FocusDomain {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Focus {
  id: string;
  user_id: string;
  domain_id: string | null;
  timeframe: FocusTimeframe;
  statement: string;
  target_type: FocusTargetType;
  target_value: number | null;
  unit: string | null;
  parent_focus_id: string | null;
  period_date: string | null;
  status: FocusStatus;
  recurrence_days_of_week: number[] | null;
  recurrence_end_date: string | null;
  created_at: string;
  updated_at: string;
}

/** A recurring daily habit as returned by the "for date" snapshot, with that
 * date's check-in (if any), whether it counts as done, and the current
 * consecutive-day streak already computed server-side. */
export interface RecurringFocus extends Focus {
  today_checkin: FocusCheckin | null;
  done: boolean;
  current_streak: number;
}

export interface FocusCheckin {
  id: string;
  user_id: string;
  focus_id: string;
  checkin_date: string;
  progress_value: number | null;
  completed: boolean | null;
  reflection_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFocusInput {
  domain_id?: string | null;
  timeframe: FocusTimeframe;
  statement: string;
  target_type?: FocusTargetType;
  target_value?: number | null;
  unit?: string | null;
  parent_focus_id?: string | null;
  period_date?: string | null;
  status?: FocusStatus;
  recurrence_days_of_week?: number[] | null;
  recurrence_end_date?: string | null;
}

export interface UpdateFocusInput {
  domain_id?: string | null;
  statement?: string;
  target_type?: FocusTargetType;
  target_value?: number | null;
  unit?: string | null;
  parent_focus_id?: string | null;
  period_date?: string | null;
  status?: FocusStatus;
  recurrence_days_of_week?: number[] | null;
  recurrence_end_date?: string | null;
}

export interface ListFocusOptions {
  timeframe?: FocusTimeframe;
  domain_id?: string;
  status?: FocusStatus;
}

export interface UpsertFocusCheckinInput {
  progress_value?: number | null;
  completed?: boolean | null;
  reflection_note?: string | null;
}

export interface TodaySnapshot {
  date: string;
  week_start: string;
  scheduled: Focus[];
  daily_recurring: RecurringFocus[];
  weekly: Focus[];
  long_term: Focus[];
}
