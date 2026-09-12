import { getClient } from '../db/poolManager.js';
import type {
  CreateFocusBody,
  UpdateFocusBody,
  UpsertFocusDomainBody,
  UpsertFocusCheckinBody,
} from '../schemas/focusSchemas.js';

const DOMAIN_COLS =
  'id, user_id, name, color, icon, sort_order, created_at, updated_at';

const FOCUS_COLS = `id, user_id, domain_id, timeframe, statement, target_type,
  target_value, unit, parent_focus_id, period_date, status,
  recurrence_days_of_week, recurrence_end_date, created_at, updated_at`;

const CHECKIN_COLS = `id, user_id, focus_id, checkin_date, progress_value,
  completed, reflection_note, created_at, updated_at`;

// --- Domains ------------------------------------------------------------------

async function listDomains(userId: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${DOMAIN_COLS} FROM focus_domains WHERE user_id = $1 ORDER BY sort_order ASC, name ASC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function createDomain(userId: string, data: UpsertFocusDomainBody) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO focus_domains (user_id, name, color, icon, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0))
       RETURNING ${DOMAIN_COLS}`,
      [
        userId,
        data.name,
        data.color ?? null,
        data.icon ?? null,
        data.sort_order ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateDomain(
  userId: string,
  id: string,
  data: UpsertFocusDomainBody
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE focus_domains SET
         name = COALESCE($3, name),
         color = COALESCE($4, color),
         icon = COALESCE($5, icon),
         sort_order = COALESCE($6, sort_order),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${DOMAIN_COLS}`,
      [
        id,
        userId,
        data.name ?? null,
        data.color ?? null,
        data.icon ?? null,
        data.sort_order ?? null,
      ]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function deleteDomain(userId: string, id: string): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'DELETE FROM focus_domains WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Focuses ------------------------------------------------------------------

async function listFocuses(
  userId: string,
  filters: { timeframe?: string; domainId?: string; status?: string }
) {
  const client = await getClient(userId);
  try {
    const conditions = ['user_id = $1'];
    const params: unknown[] = [userId];
    if (filters.timeframe) {
      params.push(filters.timeframe);
      conditions.push(`timeframe = $${params.length}`);
    }
    if (filters.domainId) {
      params.push(filters.domainId);
      conditions.push(`domain_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    const result = await client.query(
      `SELECT ${FOCUS_COLS} FROM focuses WHERE ${conditions.join(' AND ')}
       ORDER BY period_date DESC NULLS LAST, created_at DESC`,
      params
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getFocus(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${FOCUS_COLS} FROM focuses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function createFocus(userId: string, data: CreateFocusBody) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO focuses (
         user_id, domain_id, timeframe, statement, target_type, target_value,
         unit, parent_focus_id, period_date, status,
         recurrence_days_of_week, recurrence_end_date)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'none'), $6, $7, $8, $9, COALESCE($10, 'active'), $11, $12)
       RETURNING ${FOCUS_COLS}`,
      [
        userId,
        data.domain_id ?? null,
        data.timeframe,
        data.statement,
        data.target_type ?? null,
        data.target_value ?? null,
        data.unit ?? null,
        data.parent_focus_id ?? null,
        data.period_date ?? null,
        data.status ?? null,
        data.recurrence_days_of_week ?? null,
        data.recurrence_end_date ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateFocus(userId: string, id: string, data: UpdateFocusBody) {
  const client = await getClient(userId);
  try {
    // Only fields the caller actually sent are updated; an omitted field keeps
    // its stored value (mirrors cycleRepository.upsertLog's convention).
    const cols = Object.keys(data).filter((k) =>
      [
        'domain_id',
        'statement',
        'target_type',
        'target_value',
        'unit',
        'parent_focus_id',
        'period_date',
        'status',
        'recurrence_days_of_week',
        'recurrence_end_date',
      ].includes(k)
    ) as (keyof UpdateFocusBody)[];
    if (cols.length === 0) {
      return getFocus(userId, id);
    }
    const assignments = cols.map((col, i) => `${col} = $${i + 3}`);
    const values = cols.map((col) => data[col] ?? null);
    const result = await client.query(
      `UPDATE focuses SET ${[...assignments, 'updated_at = NOW()'].join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING ${FOCUS_COLS}`,
      [id, userId, ...values]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function deleteFocus(userId: string, id: string): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'DELETE FROM focuses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Check-ins ------------------------------------------------------------------

async function listCheckins(
  userId: string,
  focusId: string,
  range?: { startDate?: string; endDate?: string }
) {
  const client = await getClient(userId);
  try {
    const conditions = ['user_id = $1', 'focus_id = $2'];
    const params: unknown[] = [userId, focusId];
    if (range?.startDate) {
      params.push(range.startDate);
      conditions.push(`checkin_date >= $${params.length}`);
    }
    if (range?.endDate) {
      params.push(range.endDate);
      conditions.push(`checkin_date <= $${params.length}`);
    }
    const result = await client.query(
      `SELECT ${CHECKIN_COLS} FROM focus_checkins WHERE ${conditions.join(' AND ')}
       ORDER BY checkin_date DESC`,
      params
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function upsertCheckin(
  userId: string,
  focusId: string,
  date: string,
  data: UpsertFocusCheckinBody
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO focus_checkins (user_id, focus_id, checkin_date, progress_value, completed, reflection_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, focus_id, checkin_date) DO UPDATE SET
         progress_value = COALESCE($4, focus_checkins.progress_value),
         completed = COALESCE($5, focus_checkins.completed),
         reflection_note = COALESCE($6, focus_checkins.reflection_note),
         updated_at = NOW()
       RETURNING ${CHECKIN_COLS}`,
      [
        userId,
        focusId,
        date,
        data.progress_value ?? null,
        data.completed ?? null,
        data.reflection_note ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteCheckin(
  userId: string,
  focusId: string,
  date: string
): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'DELETE FROM focus_checkins WHERE user_id = $1 AND focus_id = $2 AND checkin_date = $3 RETURNING id',
      [userId, focusId, date]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Today snapshot -------------------------------------------------------------

interface RecurringRow {
  checkin_id: string | null;
  checkin_progress_value: number | null;
  checkin_completed: boolean | null;
  checkin_reflection_note: string | null;
  checkin_checkin_date: string | null;
  [key: string]: unknown;
}

function mapRecurringRow(row: RecurringRow) {
  const {
    checkin_id,
    checkin_progress_value,
    checkin_completed,
    checkin_reflection_note,
    checkin_checkin_date,
    ...focus
  } = row;
  return {
    ...focus,
    today_checkin: checkin_id
      ? {
          id: checkin_id,
          user_id: focus.user_id,
          focus_id: focus.id,
          checkin_date: checkin_checkin_date,
          progress_value: checkin_progress_value,
          completed: checkin_completed,
          reflection_note: checkin_reflection_note,
        }
      : null,
  };
}

/**
 * Resolves everything a "for date" view needs: one-off focuses scheduled for
 * `date` ('scheduled'), recurring daily habits active on `date`
 * ('daily_recurring', each with that date's check-in already joined in as
 * `today_checkin`), the weekly focus whose period_date (week-start) covers
 * `date`, and every active long_term focus. `weekStart` and `dayOfWeek` are
 * passed in (computed by the service layer) so this stays a pure query
 * function with no date-math of its own.
 */
async function getTodaySnapshot(
  userId: string,
  date: string,
  weekStart: string,
  dayOfWeek: number
) {
  const client = await getClient(userId);
  try {
    const [scheduled, recurring, weekly, longTerm] = await Promise.all([
      client.query(
        `SELECT ${FOCUS_COLS} FROM focuses
         WHERE user_id = $1 AND timeframe = 'daily' AND status = 'active' AND period_date = $2`,
        [userId, date]
      ),
      client.query(
        `SELECT f.*, tc.id AS checkin_id, tc.progress_value AS checkin_progress_value,
                tc.completed AS checkin_completed, tc.reflection_note AS checkin_reflection_note,
                tc.checkin_date AS checkin_checkin_date
         FROM focuses f
         LEFT JOIN focus_checkins tc
           ON tc.focus_id = f.id AND tc.user_id = f.user_id AND tc.checkin_date = $2
         WHERE f.user_id = $1 AND f.timeframe = 'daily' AND f.status = 'active'
           AND f.period_date IS NULL
           AND (f.recurrence_end_date IS NULL OR f.recurrence_end_date >= $2)
           AND (f.recurrence_days_of_week IS NULL OR $3 = ANY(f.recurrence_days_of_week))`,
        [userId, date, dayOfWeek]
      ),
      client.query(
        `SELECT ${FOCUS_COLS} FROM focuses
         WHERE user_id = $1 AND timeframe = 'weekly' AND status = 'active' AND period_date = $2`,
        [userId, weekStart]
      ),
      client.query(
        `SELECT ${FOCUS_COLS} FROM focuses
         WHERE user_id = $1 AND timeframe = 'long_term' AND status = 'active'
         ORDER BY created_at ASC`,
        [userId]
      ),
    ]);
    return {
      scheduled: scheduled.rows,
      daily_recurring: recurring.rows.map((r: Record<string, unknown>) =>
        mapRecurringRow(r as unknown as RecurringRow)
      ),
      weekly: weekly.rows,
      long_term: longTerm.rows,
    };
  } finally {
    client.release();
  }
}

/** Recent check-in history across a set of recurring focuses, for streak computation. */
async function getCheckinHistoryForFocuses(
  userId: string,
  focusIds: string[],
  sinceDate: string
) {
  if (focusIds.length === 0) return [];
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT focus_id, checkin_date, progress_value, completed
       FROM focus_checkins
       WHERE user_id = $1 AND focus_id = ANY($2) AND checkin_date >= $3
       ORDER BY focus_id, checkin_date DESC`,
      [userId, focusIds, sinceDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export default {
  listDomains,
  createDomain,
  updateDomain,
  deleteDomain,
  listFocuses,
  getFocus,
  createFocus,
  updateFocus,
  deleteFocus,
  listCheckins,
  upsertCheckin,
  deleteCheckin,
  getTodaySnapshot,
  getCheckinHistoryForFocuses,
};
