import express, { RequestHandler } from 'express';
import {
  createPlannedWorkoutRequestSchema,
  updatePlannedWorkoutRequestSchema,
  movePlannedWorkoutRequestSchema,
  completePlannedWorkoutRequestSchema,
  listPlannedWorkoutsQuerySchema,
  plannedWorkoutResponseSchema,
  todayInZone,
  type PlannedWorkoutResponse,
} from '@workspace/shared';
import { z } from 'zod';
import plannedWorkoutService from '../../services/plannedWorkoutService.js';
import { loadUserTimezone } from '../../utils/timezoneLoader.js';
import checkPermissionMiddleware from '../../middleware/checkPermissionMiddleware.js';
import { log } from '../../config/logging.js';

const router = express.Router();

router.use(checkPermissionMiddleware('diary'));

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireUuid(res: any, id: unknown): id is string {
  if (typeof id !== 'string' || !uuidRegex.test(id)) {
    res.status(400).json({ error: 'id must be a valid UUID.' });
    return false;
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendValidationError(res: any, error: z.ZodError) {
  res
    .status(400)
    .json({ error: 'Invalid request', details: error.flatten().fieldErrors });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDateOrNull(value: any): string | null {
  return value ? new Date(value).toISOString() : null;
}

interface PlannedWorkoutRowWithMissed {
  id: string;
  planned_date: string;
  planned_time: string | null;
  duration_estimate_minutes: number | null;
  title: string;
  workout_preset_id: number | null;
  exercise_id: string | null;
  workout_type: string | null;
  notes: string | null;
  status: string;
  is_missed: boolean;
  started_at: unknown;
  completed_at: unknown;
  completed_session_id: string | null;
  origin: string;
  template_id: number | null;
  assignment_id: number | null;
  user_modified: boolean;
  created_at: unknown;
  updated_at: unknown;
}

function toResponse(row: PlannedWorkoutRowWithMissed): PlannedWorkoutResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return plannedWorkoutResponseSchema.parse({
    id: row.id,
    planned_date: row.planned_date,
    planned_time: row.planned_time,
    duration_estimate_minutes: row.duration_estimate_minutes,
    title: row.title,
    workout_preset_id: row.workout_preset_id,
    exercise_id: row.exercise_id,
    workout_type: row.workout_type,
    notes: row.notes,
    status: row.status,
    is_missed: row.is_missed,
    started_at: toDateOrNull(row.started_at),
    completed_at: toDateOrNull(row.completed_at),
    completed_session_id: row.completed_session_id,
    origin: row.origin,
    template_id: row.template_id,
    assignment_id: row.assignment_id,
    user_modified: row.user_modified,
    created_at: toDateOrNull(row.created_at) as string,
    updated_at: toDateOrNull(row.updated_at) as string,
  } satisfies Record<string, unknown>);
}

async function todayFor(userId: string): Promise<string> {
  return todayInZone(await loadUserTimezone(userId));
}

/**
 * @swagger
 * /v2/planned-workouts:
 *   get:
 *     summary: List planned workouts in a date range
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Planned workouts in range }
 *       400: { description: Invalid query parameters }
 */
const listHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listPlannedWorkoutsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const today = await todayFor(req.userId);
    const rows = await plannedWorkoutService.listPlannedWorkouts(
      req.userId,
      parsed.data.from,
      parsed.data.to,
      today
    );
    res
      .status(200)
      .json((rows as PlannedWorkoutRowWithMissed[]).map(toResponse));
  } catch (error) {
    next(error);
  }
};
router.get('/', listHandler);

/**
 * @swagger
 * /v2/planned-workouts/day/{date}:
 *   get:
 *     summary: Planned + missed workouts for one date
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Day view }
 *       400: { description: Invalid date }
 */
const dayViewHandler: RequestHandler = async (req, res, next) => {
  try {
    const date = req.params.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
      return;
    }
    const today = await todayFor(req.userId);
    const { for_date, missed } = await plannedWorkoutService.getDayView(
      req.userId,
      date,
      today
    );
    res.status(200).json({
      for_date: (for_date as PlannedWorkoutRowWithMissed[]).map(toResponse),
      missed: (missed as PlannedWorkoutRowWithMissed[]).map(toResponse),
    });
  } catch (error) {
    next(error);
  }
};
router.get('/day/:date', dayViewHandler);

/**
 * @swagger
 * /v2/planned-workouts:
 *   post:
 *     summary: Create a planned workout
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Created }
 *       400: { description: Invalid request body }
 */
const createHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createPlannedWorkoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.createPlannedWorkout(
      req.userId,
      parsed.data,
      today
    );
    res.status(201).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.post('/', createHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}:
 *   get:
 *     summary: Get a planned workout by id
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Planned workout }
 *       404: { description: Not found }
 */
const getByIdHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.getPlannedWorkoutById(
      req.userId,
      req.params.id,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.get('/:id', getByIdHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}:
 *   patch:
 *     summary: Edit a planned workout's schedule/details
 *     tags: [Fitness & Workouts]
 *     description: Only a still-planned row can be patched; marks it user_modified so template regeneration leaves it alone from here on.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid request body }
 *       404: { description: Not found }
 *       409: { description: The plan is no longer in the planned state }
 */
const patchHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const parsed = updatePlannedWorkoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.updatePlannedWorkout(
      req.userId,
      req.params.id,
      parsed.data,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.patch('/:id', patchHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}/move:
 *   post:
 *     summary: Reschedule a planned workout to a new date/time
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Moved }
 *       400: { description: Invalid request body }
 *       404: { description: Not found }
 *       409: { description: The plan is no longer in the planned state }
 */
const moveHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const parsed = movePlannedWorkoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.movePlannedWorkout(
      req.userId,
      req.params.id,
      parsed.data.planned_date,
      parsed.data.planned_time,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.post('/:id/move', moveHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}/start:
 *   post:
 *     summary: Mark a planned workout started
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Started }
 *       404: { description: Not found }
 *       409: { description: The plan is no longer in the planned state }
 */
const startHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.startPlannedWorkout(
      req.userId,
      req.params.id,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.post('/:id/start', startHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}/skip:
 *   post:
 *     summary: Mark a planned workout skipped
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Skipped }
 *       404: { description: Not found }
 *       409: { description: The plan is already completed or skipped }
 */
const skipHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.skipPlannedWorkout(
      req.userId,
      req.params.id,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.post('/:id/skip', skipHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}/complete:
 *   post:
 *     summary: Complete a planned workout by linking an existing session
 *     tags: [Fitness & Workouts]
 *     description: For linking a session that already exists; a session created carrying planned_workout_id completes its plan automatically instead. Refuses a future planned_date and never overwrites an existing link.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Completed }
 *       400: { description: Invalid request body, or the plan is dated in the future }
 *       404: { description: Planned workout or session not found }
 *       409: { description: Already completed by another session }
 */
const completeHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const parsed = completePlannedWorkoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const today = await todayFor(req.userId);
    const row = await plannedWorkoutService.completePlannedWorkout(
      req.userId,
      req.params.id,
      parsed.data.session_id,
      today
    );
    res.status(200).json(toResponse(row as PlannedWorkoutRowWithMissed));
  } catch (error) {
    next(error);
  }
};
router.post('/:id/complete', completeHandler);

/**
 * @swagger
 * /v2/planned-workouts/{id}:
 *   delete:
 *     summary: Delete (or dismiss) a planned workout
 *     tags: [Fitness & Workouts]
 *     description: Only a planned or skipped row with no linked session can be removed; a template-generated row is dismissed instead of hard-deleted, so regeneration never resurrects it.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Deleted or dismissed }
 *       404: { description: Not found }
 *       409: { description: A started or completed plan cannot be deleted }
 */
const deleteHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const result = await plannedWorkoutService.deletePlannedWorkout(
      req.userId,
      req.params.id
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
router.delete('/:id', deleteHandler);

// Centralized error mapping: service errors carry `.status`; anything else
// is an unexpected 500. Placed at the end of this router only — the global
// errorHandler still catches whatever falls through app.use(demoRestrictionGuard)
// upstream, this is defense in depth matching exercisePresetEntryRoutes.ts's
// handleRouteError convention for this newer domain.
router.use(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (error: any, _req: any, res: any, next: any) => {
    if (typeof error?.status === 'number') {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      log('error', 'v2 planned-workouts response validation failed:', error);
      res.status(500).json({ error: 'Internal response validation failed' });
      return;
    }
    next(error);
  }
);

export default router;
