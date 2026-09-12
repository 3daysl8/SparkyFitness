import { getClient } from '../db/poolManager.js';
import type {
  CreateCalendarFeedBody,
  UpdateCalendarFeedBody,
} from '../schemas/calendarSchemas.js';

const FEED_COLS =
  'id, user_id, name, ics_url, color, is_enabled, created_at, updated_at';

async function listFeeds(userId: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${FEED_COLS} FROM calendar_feeds WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function listEnabledFeeds(userId: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${FEED_COLS} FROM calendar_feeds WHERE user_id = $1 AND is_enabled = true ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getFeed(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${FEED_COLS} FROM calendar_feeds WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function createFeed(userId: string, data: CreateCalendarFeedBody) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO calendar_feeds (user_id, name, ics_url, color, is_enabled)
       VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING ${FEED_COLS}`,
      [
        userId,
        data.name,
        data.ics_url,
        data.color ?? null,
        data.is_enabled ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateFeed(
  userId: string,
  id: string,
  data: UpdateCalendarFeedBody
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE calendar_feeds SET
         name = COALESCE($3, name),
         ics_url = COALESCE($4, ics_url),
         color = COALESCE($5, color),
         is_enabled = COALESCE($6, is_enabled),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${FEED_COLS}`,
      [
        id,
        userId,
        data.name ?? null,
        data.ics_url ?? null,
        data.color ?? null,
        data.is_enabled ?? null,
      ]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function deleteFeed(userId: string, id: string): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'DELETE FROM calendar_feeds WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export default {
  listFeeds,
  listEnabledFeeds,
  getFeed,
  createFeed,
  updateFeed,
  deleteFeed,
};
