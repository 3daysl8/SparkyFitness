import { tool } from 'ai';
import { z } from 'zod';
import {
  checkEntryPlausibility,
  checkSessionPlausibility,
  compareDays,
  plausibilityKindFromModality,
  setsDurationMinutes,
  todayInZone,
  type ExerciseModality,
  type PlausibilityWarning,
} from '@workspace/shared';
import { log } from '../../config/logging.js';
import exerciseService from '../../services/exerciseService.js';
import workoutPresetService from '../../services/workoutPresetService.js';
import exerciseDb from '../../models/exercise.js';
import exerciseEntryDb from '../../models/exerciseEntry.js';
import workoutPresetRepository from '../../models/workoutPresetRepository.js';
import { ERRORS, formatZodError } from './errors.js';
import {
  compactRecord,
  dayString,
  formatConfirmation,
  formatJsonResult,
  formatList,
  formatRecord,
} from './formatting.js';
import { getResolvedExerciseCaloriesRange } from '../../services/exerciseCalorieRangeService.js';
import {
  normalizePagination,
  buildPaginatedResult,
  type PaginatedResult,
} from './pagination.js';
import {
  manageExerciseSchema,
  manageExerciseInput,
  type ManageExerciseInput,
} from './schemas/exercise.js';
import { optionalDateSchema } from './schemas/common.js';
import { normalizeActionArgs, normalizeDayKeywords } from './dates.js';

const VALID_ACTIONS = [
  'search_exercises',
  'create_exercise',
  'log_exercise',
  'list_exercise_diary',
  'get_workout_presets',
  'log_workout_preset',
  'update_exercise_entry',
  'delete_exercise_entry',
  'get_exercise_details',
  'create_workout_preset',
  'get_exercise_progress',
];

// Optional inputs and nullable DB columns are treated alike: absent.
function isSet<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Text columns may hold JSON arrays, comma-separated values, or plain strings.
function safeParseJson(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      /* not JSON */
    }
    if (value.includes(',')) {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return value ? [value] : [];
  }
  return [];
}

interface ExerciseSetInput {
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  rest_time?: number;
  set_type?: string;
  rpe?: number;
  notes?: string;
}

// The set rows the exercise-entry repository expects: 1-based set_number plus
// explicit nulls for absent fields (mirrors MCP's per-set INSERT defaults).
function toRepoSets(sets: ExerciseSetInput[]) {
  return sets.map((s, i) => ({
    set_number: i + 1,
    set_type: s.set_type || 'Working Set',
    reps: s.reps ?? null,
    weight: s.weight ?? null,
    // Sets may arrive as a JSON string that bypasses schema validation, so
    // round here to keep the integer-seconds duration column safe.
    duration: typeof s.duration === 'number' ? Math.round(s.duration) : null,
    distance: s.distance ?? null,
    rest_time: s.rest_time ?? null,
    rpe: s.rpe ?? null,
    notes: s.notes ?? null,
  }));
}

// MCP's date-range defaults: a single `date` overrides start/end; otherwise
// the range defaults to today (user timezone) / the start date.
function exerciseDateRange(
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

// A coach retrying after a slow response resends the same log; an identical
// entry this recent is the same workout, not a second one.
const RETRY_GUARD_WINDOW_MS = 6 * 60 * 60 * 1000;
const ALREADY_LOGGED_ENTRY_NOTE =
  'An identical entry was logged within the last 6 hours; nothing was duplicated.';
const ALREADY_LOGGED_SESSION_NOTE =
  'A session for this workout already exists on this date; nothing was duplicated.';

function logMutation(
  userId: string,
  action: string,
  ids: Record<string, unknown>
) {
  const detail = Object.entries(ids)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  log(
    'info',
    `[Exercise Tool] tool=sparky_manage_exercise action=${action} userId=${userId} ${detail}`
  );
}

function futureEntryDateError(entryDate: string, tz: string): string | null {
  const today = todayInZone(tz);
  if (compareDays(entryDate, today) <= 0) return null;
  return ERRORS.VALIDATION(
    `entry_date ${entryDate} is in the future (today is ${today} in ${tz}). Only completed workouts can be logged, and dates are in the user's timezone.`
  );
}

function toRoundedNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
}

function normalizeSessionName(name: unknown): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function entryKind(entry: any) {
  return plausibilityKindFromModality(
    (entry?.modality ??
      entry?.exercise_snapshot?.modality ??
      null) as ExerciseModality | null
  );
}

function describeWarning(
  warning: PlausibilityWarning,
  names: readonly string[] = []
): string {
  const name =
    warning.entryIndex !== undefined ? names[warning.entryIndex] : undefined;
  const label = name ? `${warning.code} (${name})` : warning.code;
  const value = Math.round(warning.value * 10) / 10;
  switch (warning.code) {
    case 'entry_duration_high':
      return `${label}: duration ${value} min exceeds ${warning.threshold} min`;
    case 'entry_calories_high':
      return `${label}: ${value} kcal exceeds ${warning.threshold} kcal`;
    case 'calorie_rate_high':
      return `${label}: ${value} kcal/min exceeds ${warning.threshold} kcal/min`;
    case 'session_duration_high':
      return `${label}: session total ${value} min exceeds ${warning.threshold} min`;
  }
}

function formatEntryRecord(
  title: string,
  entry: any,
  fallbackDate?: string,
  alreadyLogged?: boolean
): string {
  const warnings = checkEntryPlausibility({
    duration_minutes: toRoundedNumber(entry?.duration_minutes),
    calories_burned: toRoundedNumber(entry?.calories_burned),
    kind: entryKind(entry),
  }).map((w) => describeWarning(w));
  return formatRecord(
    title,
    {
      id: entry?.id,
      entry_date: isSet(entry?.entry_date)
        ? dayString(entry.entry_date)
        : fallbackDate,
      exercise: entry?.exercise_name ?? entry?.name,
      exercise_id: entry?.exercise_id,
      duration_minutes: toRoundedNumber(entry?.duration_minutes),
      calories_burned: toRoundedNumber(entry?.calories_burned),
      sets: Array.isArray(entry?.sets) ? entry.sets.length : undefined,
      session_id: entry?.exercise_preset_entry_id,
      already_logged: alreadyLogged,
      note: alreadyLogged ? ALREADY_LOGGED_ENTRY_NOTE : undefined,
    },
    warnings
  );
}

function formatSessionRecord(
  title: string,
  session: any,
  fallbackDate: string,
  alreadyLogged: boolean
): string {
  const exercises: any[] = Array.isArray(session?.exercises)
    ? session.exercises
    : [];
  const names = exercises.map((e) =>
    String(e.exercise_name ?? e.name ?? e.exercise_snapshot?.name ?? '')
  );
  const total = (key: string) =>
    toRoundedNumber(
      exercises.reduce((sum, e) => sum + (Number(e[key]) || 0), 0)
    );
  const warnings = checkSessionPlausibility(
    exercises.map((e) => ({
      duration_minutes: toRoundedNumber(e.duration_minutes),
      calories_burned: toRoundedNumber(e.calories_burned),
      kind: entryKind(e),
    }))
  ).map((w) => describeWarning(w, names));
  return formatRecord(
    title,
    {
      session_id: session?.id,
      entry_date: isSet(session?.entry_date)
        ? dayString(session.entry_date)
        : fallbackDate,
      name: session?.name,
      workout_preset_id: session?.workout_preset_id,
      source: session?.source,
      exercises: names.filter(Boolean),
      exercise_count: exercises.length,
      entry_ids: exercises.map((e) => e.id).filter(isSet),
      duration_minutes: total('duration_minutes'),
      calories_burned: total('calories_burned'),
      sets: exercises.reduce(
        (sum, e) => sum + (Array.isArray(e.sets) ? e.sets.length : 0),
        0
      ),
      already_logged: alreadyLogged,
      note: alreadyLogged ? ALREADY_LOGGED_SESSION_NOTE : undefined,
    },
    warnings
  );
}

// A non-empty grouped session on that date for the same preset, or with the
// same name (the app saves sessions with a NULL workout_preset_id).
async function findLoggedPresetSession(
  userId: string,
  entryDate: string,
  preset: { id: unknown; name?: unknown }
) {
  const grouped = await exerciseService.getExerciseEntriesByDate(
    userId,
    userId,
    entryDate
  );
  const presetName = normalizeSessionName(preset.name);
  return (Array.isArray(grouped) ? grouped : []).find(
    (item: any) =>
      item.type === 'preset' &&
      Array.isArray(item.exercises) &&
      item.exercises.length > 0 &&
      ((isSet(item.workout_preset_id) &&
        String(item.workout_preset_id) === String(preset.id)) ||
        (presetName !== '' && normalizeSessionName(item.name) === presetName))
  );
}

async function findRecentIdenticalEntry(
  userId: string,
  criteria: {
    exerciseId: string;
    entryDate: string;
    durationMinutes: number;
    setCount: number;
  }
) {
  const grouped = await exerciseService.getExerciseEntriesByDate(
    userId,
    userId,
    criteria.entryDate
  );
  const cutoff = Date.now() - RETRY_GUARD_WINDOW_MS;
  return (Array.isArray(grouped) ? grouped : [])
    .flatMap((item: any) =>
      item.type === 'preset' ? (item.exercises ?? []) : [item]
    )
    .find((entry: any) => {
      const createdAt = new Date(entry.created_at).getTime();
      return (
        String(entry.exercise_id) === criteria.exerciseId &&
        Number.isFinite(createdAt) &&
        createdAt >= cutoff &&
        Math.abs(
          (Number(entry.duration_minutes) || 0) - criteria.durationMinutes
        ) < 0.01 &&
        (Array.isArray(entry.sets) ? entry.sets.length : 0) ===
          criteria.setCount
      );
    });
}

// Renders a row's bare-DATE entry_date as a calendar-day string for JSON
// output. entry_date is nullable; NULL stays JSON null, not the string "null".
function projectEntryDate<T extends { entry_date?: unknown }>(row: T) {
  if (!isSet(row.entry_date)) return row;
  return { ...row, entry_date: dayString(row.entry_date) };
}

// exercise_entries dumps (`SELECT ee.*`/`SELECT *`, used by the diary, recent,
// and usage tools) carry audit/ownership columns and internal surrogate keys.
// `id` (edit/delete) and `exercise_id` (lookups / re-logging) are kept, as are
// populated metrics and the denormalized catalog fields.
const EXERCISE_ENTRY_DROP: readonly string[] = [
  'user_id',
  'created_at',
  'updated_at',
  'created_by_user_id',
  'updated_by_user_id',
  'workout_plan_assignment_id',
  'exercise_preset_entry_id',
  'sort_order',
];
// exercise_entry_sets dumps (`SELECT *`): audit timestamps and per-set
// completion timestamps are token noise for the chatbot.
// `exercise_entry_id` is kept so the model can map sets back to their entry.
const EXERCISE_SET_DROP: readonly string[] = [
  'created_at',
  'updated_at',
  'completed_at',
];
// exercises catalog rows (sparky_list_exercises) — drop the redundant caller id
// and audit columns; keep descriptive catalog fields.
const EXERCISE_CATALOG_DROP: readonly string[] = [
  'user_id',
  'created_at',
  'updated_at',
  'created_by_user_id',
  'updated_by_user_id',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projectExerciseEntry(row: any) {
  return compactRecord(projectEntryDate(row), EXERCISE_ENTRY_DROP);
}

// The column set MCP's exercise search exposed; richer server rows are
// projected down to it so the chat-visible output stays identical.
function projectExercise(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    muscle_groups: row.primary_muscles,
    equipment: row.equipment,
    level: row.level,
    calories_per_hour: row.calories_per_hour,
    description: row.description,
    is_custom: row.is_custom,
  };
}

// Case-insensitive exact name lookup (MCP's `name ILIKE $1` without
// wildcards). The server search returns substring matches; the exact match,
// when present, is always among them.
export async function findExerciseByExactName(userId: string, name: string) {
  const rows = await exerciseService.searchExercises(
    userId,
    name,
    userId,
    undefined,
    undefined
  );
  return rows.find(
    (e: any) => String(e.name).toLowerCase() === name.toLowerCase()
  );
}

// Full details for one exercise by id or name, projected to MCP's shape.
// Throws "not found" errors for the callers' catch blocks to map.
async function getExerciseDetails(
  userId: string,
  params: { exercise_id?: string; exercise_name?: string }
) {
  let row: any;
  if (params.exercise_id) {
    row = await exerciseService.getExerciseById(userId, params.exercise_id);
  } else if (params.exercise_name) {
    row = await findExerciseByExactName(userId, params.exercise_name);
  } else {
    throw new Error('Either exercise_id or exercise_name must be provided');
  }
  if (!row) {
    throw new Error('Exercise not found');
  }
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    muscle_groups: safeParseJson(row.primary_muscles),
    equipment: safeParseJson(row.equipment),
    level: row.level,
    calories_per_hour: row.calories_per_hour,
    description: row.description,
    is_custom: row.is_custom,
    instructions: safeParseJson(row.instructions),
    images: safeParseJson(row.images),
  };
}

interface ProgressDay {
  entry_date: string;
  max_weight: number | null;
  max_reps: number | null;
  total_volume: number | null;
}

// Per-date set aggregates for one exercise, paginated over the grouped days.
// Mirrors MCP's GROUP BY query: days whose entries have no sets are excluded,
// MAX/SUM skip null reps/weights, and volume counts null weights as 0.
async function getExerciseProgress(
  userId: string,
  params: {
    exercise_id?: string;
    exercise_name?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedResult<ProgressDay>> {
  let exerciseId = params.exercise_id;
  if (!exerciseId && params.exercise_name) {
    const exercise = await findExerciseByExactName(
      userId,
      params.exercise_name
    );
    exerciseId = exercise?.id;
  }
  if (!exerciseId) throw new Error('Exercise not found');

  const entries = await exerciseService.getExerciseProgressData(
    userId,
    exerciseId,
    params.start_date || '1970-01-01',
    params.end_date || '9999-12-31'
  );

  // Repository rows arrive in entry_date ASC order; the Map keeps it.
  const byDate = new Map<string, ProgressDay>();
  for (const entry of entries) {
    const sets: ExerciseSetInput[] = entry.sets ?? [];
    if (sets.length === 0) continue;
    const key = dayString(entry.entry_date);
    let day = byDate.get(key);
    if (!day) {
      day = {
        entry_date: key,
        max_weight: null,
        max_reps: null,
        total_volume: null,
      };
      byDate.set(key, day);
    }
    for (const s of sets) {
      if (isSet(s.weight)) {
        const weight = Number(s.weight);
        day.max_weight = isSet(day.max_weight)
          ? Math.max(day.max_weight, weight)
          : weight;
      }
      if (isSet(s.reps)) {
        day.max_reps = isSet(day.max_reps)
          ? Math.max(day.max_reps, s.reps)
          : s.reps;
        day.total_volume =
          (day.total_volume ?? 0) +
          s.reps * (isSet(s.weight) ? Number(s.weight) : 0);
      }
    }
  }

  const days = [...byDate.values()];
  const { limit, offset } = normalizePagination(params.limit, params.offset);
  return buildPaginatedResult(
    days.slice(offset, offset + limit),
    days.length,
    offset
  );
}

// Standalone domain tools.
const exerciseDateRangeSchema = z.object({
  date: optionalDateSchema,
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
});

const exercisePaginationSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const listExercisesSchema = exercisePaginationSchema.extend({
  search: z.string().optional(),
});

const getExerciseDetailsSchema = z.object({
  exercise_id: z.string().optional(),
  exercise_name: z.string().optional(),
});

const searchExercisesSchema = exercisePaginationSchema.extend({
  query: z.string().min(1),
  muscle_group: z.string().optional(),
  equipment: z.string().optional(),
});

const recentExerciseEntriesSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

const exerciseUsageSchema = exerciseDateRangeSchema
  .merge(exercisePaginationSchema)
  .extend({
    exercise_id: z.string().min(1),
  });

const exerciseProgressSchema = exerciseDateRangeSchema
  .merge(exercisePaginationSchema)
  .extend({
    exercise_id: z.string().optional(),
    exercise_name: z.string().optional(),
  });

export function buildExerciseTools(userId: string, tz: string) {
  return {
    sparky_manage_exercise: tool({
      description: `Fitness tracking: search exercises, log workouts with sets, manage presets.

Actions:
- search_exercises(searchTerm, muscleGroup?, equipment?, limit?, offset?)
- create_exercise(name, category?, calories_per_hour?, description?, modality?:weight_reps|reps_only|duration|duration_distance)
- log_exercise(entry_date, exercise_id?|exercise_name?, duration_minutes?, calories_burned?, notes?, distance?, avg_heart_rate?, steps?, sets?:JSON string or array of [{reps,weight,duration,distance,rest_time,set_type,rpe,notes}]) — distance/avg_heart_rate/steps are for cardio. Returns the saved entry; an identical entry logged in the last 6 hours is returned with already_logged: true instead of being duplicated
- list_exercise_diary(entry_date)
- get_workout_presets()
- log_workout_preset(entry_date, preset_id?|preset_name?) — preset_id is the integer ID from get_workout_presets. If entry_date already has a non-empty session for this preset (same preset ID or same name, e.g. saved from the app), that session is returned with already_logged: true and nothing is created
- update_exercise_entry(entry_id, entry_date?, duration_minutes?, calories_burned?, notes?, distance?, avg_heart_rate?, steps?, sets?) — only the provided fields change; sets, when provided, replace all existing sets. Returns the updated entry
- delete_exercise_entry(entry_id)
- get_exercise_details(exercise_id?|exercise_name?)
- create_workout_preset(name, exercise_ids)
- get_exercise_progress(exercise_id?|exercise_name?, start_date?, end_date?, limit?, offset?) — returns paginated performance history

log_exercise and log_workout_preset only record completed workouts: entry_date must be today or earlier in the user's timezone. Returned records include plausibility warnings; confirm flagged values with the user.`,
      inputSchema: manageExerciseInput,
      execute: async (rawArgs) => {
        const normalized = normalizeActionArgs(
          rawArgs,
          tz,
          VALID_ACTIONS,
          (args) => {
            if (args.searchTerm) {
              return 'search_exercises';
            }
            if (args.sets || args.duration_minutes || args.calories_burned) {
              return 'log_exercise';
            }
            if (args.preset_id || args.preset_name) {
              return 'log_workout_preset';
            }
            if (args.entry_id) {
              return 'update_exercise_entry';
            }
            if (args.start_date || args.end_date) {
              return 'get_exercise_progress';
            }
            if (args.entry_date) {
              return 'list_exercise_diary';
            }
            return 'list_exercise_diary'; // fallback
          }
        ) as any;

        // Default missing entry_date to today's date string for logging actions
        const loggingActions = ['log_exercise', 'log_workout_preset'];
        if (
          normalized.entry_date === undefined &&
          loggingActions.includes(normalized.action)
        ) {
          normalized.entry_date = todayInZone(tz);
        }

        const parsed = manageExerciseSchema.safeParse(normalized);
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        const args: ManageExerciseInput = parsed.data;
        try {
          switch (args.action) {
            case 'search_exercises': {
              const { limit, offset } = normalizePagination(
                args.limit,
                args.offset
              );
              const { exercises, totalCount } =
                await exerciseService.searchExercisesPaginated(
                  userId,
                  args.searchTerm,
                  userId,
                  args.equipment ? [args.equipment] : undefined,
                  args.muscleGroup ? [args.muscleGroup] : undefined,
                  limit,
                  offset
                );
              const result = buildPaginatedResult(
                exercises.map(projectExercise),
                totalCount,
                offset
              );
              return formatList(
                result.data,
                `Exercise Search: "${args.searchTerm}"`,
                (e: any) =>
                  `**${e.name}** (${e.category || 'Uncategorized'})\n  Muscles: ${e.muscle_groups?.join(', ') || 'N/A'} | Equipment: ${e.equipment?.join(', ') || 'None'}\n  ID: ${e.id}`,
                {
                  total_count: result.total_count,
                  has_more: result.has_more,
                  next_offset: result.next_offset,
                }
              );
            }

            case 'create_exercise': {
              // MCP returned the existing exercise (same confirmation text)
              // when one already matched the name case-insensitively.
              const existing = await findExerciseByExactName(userId, args.name);
              const exercise =
                existing ??
                (await exerciseService.createExercise(userId, {
                  name: args.name,
                  category: args.category || 'custom',
                  calories_per_hour: args.calories_per_hour || 300,
                  description: args.description || null,
                  modality: args.modality,
                  is_custom: true,
                  shared_with_public: false,
                  source: 'manual',
                }));
              if (!existing) {
                logMutation(userId, 'create_exercise', {
                  exercise_id: exercise.id,
                });
              }
              return formatConfirmation(`Exercise "${exercise.name}" created.`);
            }

            case 'log_exercise': {
              const futureError = futureEntryDateError(args.entry_date, tz);
              if (futureError) return futureError;
              if (!args.exercise_id && !args.exercise_name) {
                args.exercise_name = 'General Exercise';
              }
              // Parse sets if it arrives as a JSON string (LLM serialisation quirk)
              let parsedSets: ExerciseSetInput[] | undefined;
              if (typeof args.sets === 'string') {
                try {
                  parsedSets = JSON.parse(args.sets);
                } catch {
                  parsedSets = undefined;
                }
              } else {
                parsedSets = args.sets;
              }
              let exerciseId = args.exercise_id;
              if (!exerciseId && args.exercise_name) {
                // Exact match first, then fuzzy, then auto-create — MCP's
                // resolution order.
                const rows = await exerciseService.searchExercises(
                  userId,
                  args.exercise_name,
                  userId,
                  undefined,
                  undefined
                );
                const name = args.exercise_name.toLowerCase();
                const found =
                  rows.find(
                    (e: any) => String(e.name).toLowerCase() === name
                  ) ?? rows[0];
                if (found) {
                  exerciseId = found.id;
                } else {
                  const created = await exerciseService.createExercise(userId, {
                    name: args.exercise_name,
                    category: 'custom',
                    calories_per_hour: 300,
                    is_custom: true,
                    shared_with_public: false,
                    source: 'manual',
                  });
                  exerciseId = created.id;
                }
              }
              const repoSets = parsedSets ? toRepoSets(parsedSets) : undefined;
              const existingEntry = await findRecentIdenticalEntry(userId, {
                exerciseId: String(exerciseId),
                entryDate: args.entry_date,
                durationMinutes:
                  args.duration_minutes ?? setsDurationMinutes(repoSets),
                setCount: repoSets?.length ?? 0,
              });
              if (existingEntry) {
                logMutation(userId, 'log_exercise', {
                  entry_id: existingEntry.id,
                  already_logged: true,
                });
                return formatEntryRecord(
                  `Exercise already logged for ${args.entry_date}`,
                  existingEntry,
                  args.entry_date,
                  true
                );
              }
              // skipDuplicateCheck: outside the retry guard, logging the same
              // exercise twice in a day must create two entries (MCP always
              // inserted), not merge into the server's manual upsert.
              const entry = await exerciseService.createExerciseEntry(
                userId,
                userId,
                {
                  exercise_id: exerciseId,
                  entry_date: args.entry_date,
                  entry_time: args.entry_time,
                  duration_minutes: args.duration_minutes,
                  calories_burned: args.calories_burned,
                  notes: args.notes,
                  distance: args.distance,
                  avg_heart_rate: args.avg_heart_rate,
                  steps: args.steps,
                  sets: repoSets,
                },
                { skipDuplicateCheck: true }
              );
              logMutation(userId, 'log_exercise', { entry_id: entry?.id });
              return formatEntryRecord(
                `Exercise logged for ${args.entry_date}`,
                entry,
                args.entry_date,
                false
              );
            }

            case 'list_exercise_diary': {
              const grouped = await exerciseService.getExerciseEntriesByDate(
                userId,
                userId,
                args.entry_date
              );
              // Flatten preset sessions into their member entries and render
              // the flat per-entry list MCP produced (created_at ASC).
              const entries = grouped
                .flatMap((item: any) =>
                  item.type === 'preset' ? item.exercises : [item]
                )
                .sort(
                  (a: any, b: any) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
              return formatList(
                entries,
                `Exercise Diary: ${args.entry_date}`,
                (e: any) => {
                  let text = `**${e.name}**`;
                  const sets: ExerciseSetInput[] = e.sets ?? [];
                  if (sets.length > 0) text += ` — ${sets.length} sets`;
                  if (e.duration_minutes)
                    text += ` | ${e.duration_minutes} min`;
                  if (e.calories_burned) text += ` | ${e.calories_burned} kcal`;
                  if (isSet(e.distance)) text += ` | ${e.distance} dist`;
                  if (isSet(e.avg_heart_rate))
                    text += ` | ${e.avg_heart_rate} bpm`;
                  if (isSet(e.steps)) text += ` | ${e.steps} steps`;
                  if (sets.length > 0) {
                    const setLine = sets
                      .map((s) => {
                        const parts: string[] = [];
                        if (isSet(s.reps)) parts.push(`${s.reps}r`);
                        if (isSet(s.weight)) parts.push(`${s.weight}kg`);
                        if (isSet(s.duration)) parts.push(`${s.duration}s`);
                        if (isSet(s.distance)) parts.push(`${s.distance}km`);
                        if (isSet(s.rpe)) parts.push(`RPE ${s.rpe}`);
                        let str = parts.join('×');
                        if (isSet(s.rest_time))
                          str += ` (rest ${s.rest_time}s)`;
                        if (s.notes) str += ` (${s.notes})`;
                        return str;
                      })
                      .filter(Boolean)
                      .join('; ');
                    if (setLine) text += `\n  Sets: ${setLine}`;
                  }
                  if (e.notes) text += `\n  Notes: ${e.notes}`;
                  text += `\n  ID: ${e.id}`;
                  return text;
                }
              );
            }

            case 'get_workout_presets': {
              const { presets } = await workoutPresetService.getWorkoutPresets(
                userId,
                1,
                1000
              );
              return formatList(
                presets,
                'Workout Presets',
                (p: any) =>
                  `**${p.name}** — ${p.exercises.length} exercises\n  ID: ${p.id}`
              );
            }

            case 'log_workout_preset': {
              if (!args.preset_id && !args.preset_name) {
                return ERRORS.VALIDATION(
                  'Either preset_id or preset_name must be provided'
                );
              }
              const futureError = futureEntryDateError(args.entry_date, tz);
              if (futureError) return futureError;
              const preset = args.preset_id
                ? await workoutPresetRepository.getWorkoutPresetById(
                    args.preset_id,
                    userId
                  )
                : await workoutPresetRepository.getWorkoutPresetByName(
                    userId,
                    args.preset_name
                  );
              if (!preset) {
                return ERRORS.NOT_FOUND('Resource', 'unknown');
              }
              const existingSession = await findLoggedPresetSession(
                userId,
                args.entry_date,
                preset
              );
              if (existingSession) {
                logMutation(userId, 'log_workout_preset', {
                  session_id: existingSession.id,
                  already_logged: true,
                });
                return formatSessionRecord(
                  `Workout already logged for ${args.entry_date}`,
                  existingSession,
                  args.entry_date,
                  true
                );
              }
              const session = await exerciseService.logWorkoutPresetGrouped(
                userId,
                userId,
                preset.id,
                args.entry_date
              );
              logMutation(userId, 'log_workout_preset', {
                session_id: session?.id,
                preset_id: preset.id,
              });
              return formatSessionRecord(
                `Workout preset logged for ${args.entry_date}`,
                session,
                args.entry_date,
                false
              );
            }

            case 'update_exercise_entry': {
              // Parse sets if it arrives as a JSON string, matching log_exercise.
              let parsedSets: ExerciseSetInput[] | undefined;
              if (typeof args.sets === 'string') {
                try {
                  parsedSets = JSON.parse(args.sets);
                } catch {
                  return ERRORS.VALIDATION('Invalid JSON format for sets');
                }
              } else {
                parsedSets = args.sets;
              }
              try {
                await exerciseService.updateExerciseEntry(
                  userId,
                  userId,
                  args.entry_id,
                  {
                    entry_date: args.entry_date,
                    entry_time: args.entry_time,
                    duration_minutes: args.duration_minutes,
                    calories_burned: args.calories_burned,
                    notes: args.notes,
                    distance: args.distance,
                    avg_heart_rate: args.avg_heart_rate,
                    steps: args.steps,
                    sets: parsedSets ? toRepoSets(parsedSets) : undefined,
                  }
                );
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message.includes('not found')
                ) {
                  return ERRORS.NOT_FOUND('Exercise Entry', args.entry_id);
                }
                throw error;
              }
              logMutation(userId, 'update_exercise_entry', {
                entry_id: args.entry_id,
              });
              const updatedEntry = await exerciseService.getExerciseEntryById(
                userId,
                args.entry_id
              );
              return formatEntryRecord('Exercise entry updated', updatedEntry);
            }

            case 'delete_exercise_entry': {
              try {
                await exerciseService.deleteExerciseEntry(
                  userId,
                  args.entry_id
                );
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message.includes('not found')
                ) {
                  return ERRORS.NOT_FOUND('Exercise Entry', args.entry_id);
                }
                throw error;
              }
              logMutation(userId, 'delete_exercise_entry', {
                entry_id: args.entry_id,
              });
              return formatConfirmation('Exercise entry deleted.');
            }

            case 'get_exercise_details': {
              const exercise = await getExerciseDetails(userId, {
                exercise_id: args.exercise_id,
                exercise_name: args.exercise_name,
              });
              let text = `### ${exercise.name}\n\n`;
              if (exercise.description) text += `*${exercise.description}*\n\n`;
              text += `**Category:** ${exercise.category}\n`;
              text += `**Equipment:** ${exercise.equipment?.join(', ') || 'None'}\n`;
              text += `**Muscles:** ${exercise.muscle_groups?.join(', ') || 'N/A'}\n\n`;

              if (exercise.instructions && exercise.instructions.length > 0) {
                text += '#### Instructions\n';
                exercise.instructions.forEach((ins, i) => {
                  text += `${i + 1}. ${ins}\n`;
                });
              }

              return text;
            }

            case 'create_workout_preset': {
              const preset = await workoutPresetService.createWorkoutPreset(
                userId,
                {
                  user_id: userId,
                  name: args.name,
                  description: null,
                  is_public: false,
                  exercises: args.exercise_ids.map((exerciseId, i) => ({
                    exercise_id: exerciseId,
                    sort_order: i,
                  })),
                }
              );
              logMutation(userId, 'create_workout_preset', {
                preset_id: preset.id,
              });
              return formatConfirmation(
                `Workout preset "${preset.name}" created with ${preset.exercises.length} exercises.`
              );
            }

            case 'get_exercise_progress': {
              const progress = await getExerciseProgress(userId, {
                exercise_id: args.exercise_id,
                exercise_name: args.exercise_name,
                start_date: args.start_date,
                end_date: args.end_date,
                limit: args.limit,
                offset: args.offset,
              });
              return formatList(
                progress.data,
                `Exercise Progress: ${args.exercise_name || args.exercise_id}`,
                (p: any) =>
                  `**${p.entry_date}**: Max Weight: ${p.max_weight}kg | Max Reps: ${p.max_reps} | Volume: ${p.total_volume}kg`,
                {
                  total_count: progress.total_count,
                  has_more: progress.has_more,
                  next_offset: progress.next_offset,
                }
              );
            }

            default:
              return ERRORS.INVALID_ACTION(
                String((args as any).action),
                VALID_ACTIONS
              );
          }
        } catch (error) {
          log('error', '[Exercise Tool] Error:', error);
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND('Resource', 'unknown');
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_list_exercises: tool({
      description:
        'Returns a paginated exercise catalog for the authenticated user.',
      inputSchema: listExercisesSchema,
      execute: async (rawArgs) => {
        const parsed = listExercisesSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const { limit, offset } = normalizePagination(
            parsed.data.limit,
            parsed.data.offset
          );
          const search = parsed.data.search?.trim() || undefined;
          const [rows, totalCount] = await Promise.all([
            exerciseDb.getExercisesWithPagination(
              userId,
              search,
              null,
              null,
              null,
              null,
              limit,
              offset
            ),
            exerciseDb.countExercises(userId, search, null, null, null, null),
          ]);
          const data = buildPaginatedResult(
            rows.map((r: Record<string, unknown>) =>
              compactRecord(r, EXERCISE_CATALOG_DROP)
            ),
            totalCount,
            offset
          );
          return formatJsonResult(data);
        } catch (error) {
          log('error', '[Exercise Tool] sparky_list_exercises error:', error);
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND('Exercise', 'unknown');
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_exercise_details: tool({
      description:
        'Returns full details for one exercise by exercise_id or exercise_name.',
      inputSchema: getExerciseDetailsSchema,
      execute: async (rawArgs) => {
        const parsed = getExerciseDetailsSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const data = await getExerciseDetails(userId, parsed.data);
          return formatJsonResult(data);
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_exercise_details error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Exercise',
              parsed.data.exercise_id || parsed.data.exercise_name || 'unknown'
            );
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_search_exercises: tool({
      description: 'Searches exercises by name and optional filters.',
      inputSchema: searchExercisesSchema,
      execute: async (rawArgs) => {
        const parsed = searchExercisesSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const args = parsed.data;
          const { limit, offset } = normalizePagination(
            args.limit,
            args.offset
          );
          const { exercises, totalCount } =
            await exerciseService.searchExercisesPaginated(
              userId,
              args.query,
              userId,
              args.equipment ? [args.equipment] : undefined,
              args.muscle_group ? [args.muscle_group] : undefined,
              limit,
              offset
            );
          const data = buildPaginatedResult(
            exercises.map(projectExercise),
            totalCount,
            offset
          );
          return formatJsonResult(data);
        } catch (error) {
          log('error', '[Exercise Tool] sparky_search_exercises error:', error);
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND('Exercise', parsed.data.query);
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_exercise_diary: tool({
      description:
        'Returns entry-level exercise diary data for a specific date or date range.',
      inputSchema: exerciseDateRangeSchema,
      execute: async (rawArgs) => {
        const parsed = exerciseDateRangeSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const { startDate, endDate } = exerciseDateRange(parsed.data, tz);
          const { entries, sets } = await exerciseEntryDb.getExerciseDiaryRange(
            userId,
            startDate,
            endDate
          );
          const data = {
            start_date: startDate,
            end_date: endDate,
            entries: entries.map(projectExerciseEntry),
            sets: sets.map((s: Record<string, unknown>) =>
              compactRecord(s, EXERCISE_SET_DROP)
            ),
          };
          return formatJsonResult(data);
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_exercise_diary error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Exercise diary',
              parsed.data.date || parsed.data.start_date || 'unknown'
            );
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_daily_exercise_totals: tool({
      description: 'Returns daily exercise totals for a date or range.',
      inputSchema: exerciseDateRangeSchema,
      execute: async (rawArgs) => {
        const parsed = exerciseDateRangeSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const { startDate, endDate } = exerciseDateRange(parsed.data, tz);
          const rows = await exerciseEntryDb.getDailyExerciseTotalsRange(
            userId,
            startDate,
            endDate
          );
          // `calories_burned` reports the resolved figure — max(device summary,
          // logged + background steps) — so it matches the Diary. The raw row sum
          // double-counts a device summary against the workouts it already includes.
          const resolvedByDate = await getResolvedExerciseCaloriesRange(
            userId,
            startDate,
            endDate
          );
          const data = {
            start_date: startDate,
            end_date: endDate,
            rows: rows.map((row: { entry_date?: unknown }) => {
              const projected = projectEntryDate(row) as Record<
                string,
                unknown
              >;
              const resolved = resolvedByDate.get(String(projected.entry_date));
              return resolved
                ? { ...projected, calories_burned: resolved.calories }
                : projected;
            }),
          };
          return formatJsonResult(data);
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_daily_exercise_totals error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Exercise totals',
              parsed.data.date || parsed.data.start_date || 'unknown'
            );
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_recent_exercise_entries: tool({
      description:
        'Returns recent entry-level exercise diary rows for the authenticated user.',
      inputSchema: recentExerciseEntriesSchema,
      execute: async (rawArgs) => {
        const parsed = recentExerciseEntriesSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const limit = Math.min(Math.max(parsed.data.limit ?? 50, 1), 200);
          const rows = await exerciseEntryDb.getRecentExerciseEntries(
            userId,
            limit
          );
          return formatJsonResult(rows.map(projectExerciseEntry));
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_recent_exercise_entries error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND('Exercise entries', 'recent');
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_exercise_usage: tool({
      description:
        'Shows where a specific exercise_id was used in the exercise diary.',
      inputSchema: exerciseUsageSchema,
      execute: async (rawArgs) => {
        const parsed = exerciseUsageSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const { exercise_id, ...query } = parsed.data;
          const { startDate, endDate } = exerciseDateRange(query, tz);
          const { limit, offset } = normalizePagination(
            query.limit,
            query.offset
          );
          const { rows, totalCount } = await exerciseEntryDb.getExerciseUsage(
            userId,
            exercise_id,
            startDate,
            endDate,
            limit,
            offset
          );
          const data = buildPaginatedResult(
            rows.map(projectExerciseEntry),
            totalCount,
            offset
          );
          return formatJsonResult(data);
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_exercise_usage error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND('Exercise', parsed.data.exercise_id);
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),

    sparky_get_exercise_progress: tool({
      description: 'Returns paginated performance history for an exercise.',
      inputSchema: exerciseProgressSchema,
      execute: async (rawArgs) => {
        const parsed = exerciseProgressSchema.safeParse(
          normalizeDayKeywords(rawArgs, tz)
        );
        if (!parsed.success) {
          return formatZodError(parsed.error);
        }
        try {
          const data = await getExerciseProgress(userId, parsed.data);
          return formatJsonResult(data);
        } catch (error) {
          log(
            'error',
            '[Exercise Tool] sparky_get_exercise_progress error:',
            error
          );
          if (error instanceof Error && error.message.includes('not found')) {
            return ERRORS.NOT_FOUND(
              'Exercise',
              parsed.data.exercise_id || parsed.data.exercise_name || 'unknown'
            );
          }
          return ERRORS.DB_ERROR(error);
        }
      },
    }),
  };
}
