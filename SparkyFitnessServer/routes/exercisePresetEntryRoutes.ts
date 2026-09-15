import express from 'express';
import { z } from 'zod';
import {
  createPresetSessionRequestSchema,
  updatePresetSessionRequestSchema,
  presetSessionResponseSchema,
  todayInZone,
} from '@workspace/shared';
import exercisePresetEntryRepository from '../models/exercisePresetEntryRepository.js';
import { SYNC_ENTRY_SOURCES } from '../models/exerciseEntry.js';
import exerciseService from '../services/exerciseService.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { log } from '../config/logging.js';
const router = express.Router();
const presetEntryIdParamSchema = z.object({
  id: z.string().uuid(),
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendValidationError(res: any, message: any, error: any) {
  return res.status(400).json({
    error: message,
    details: error.flatten(),
  });
}
// Syncs and plan generation write future-dated sessions on purpose; only a
// manually logged workout cannot have happened yet.
async function isFutureManualEntryDate(
  userId: string,
  entryDate: string,
  source: string | undefined
) {
  if (
    source === 'Workout Plan' ||
    (source !== undefined && SYNC_ENTRY_SOURCES.includes(source))
  ) {
    return false;
  }
  return entryDate > todayInZone(await loadUserTimezone(userId));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleRouteError(error: any, res: any, next: any) {
  if (error?.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof z.ZodError) {
    log('error', 'Grouped workout response validation failed:', error);
    return next(
      Object.assign(new Error('Internal response validation failed'), {
        status: 500,
      })
    );
  }
  return next(error);
}
/**
 * @swagger
 * tags:
 *   name: Fitness & Workouts
 *   description: Exercise database, workout presets, and activity logging.
 */
/**
 * @swagger
 * /exercise-preset-entries:
 *   post:
 *     summary: Create a grouped workout session
 *     tags: [Fitness & Workouts]
 *     description: |
 *       Creates a grouped workout from a workout preset, an inline exercises array, or both.
 *       `workout_preset_id` alone copies that preset's own stored exercise/set structure.
 *       `exercises` alone creates a freeform session with the given structure.
 *       Both together (e.g. a live workout started from a preset) tag the session to that
 *       preset for stats scoping while using the client-supplied exercise/set structure
 *       verbatim, keeping the session editable like any other client-authored session.
 *       Returns the full nested grouped session payload used by the mobile client.
 *       A `client_request_id` makes the save idempotent: repeating the request returns
 *       the session the first one created.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: A repeat of an earlier request with the same client_request_id and payload; returns the session that request created.
 *       201:
 *         description: The grouped workout session was created successfully.
 *       400:
 *         description: Invalid request body, or a manually logged session dated in the future.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Workout preset not found.
 *       409:
 *         description: The client_request_id was already used for a different payload.
 */
router.post('/', isAuthenticated, async (req, res, next) => {
  try {
    const parsedBody = createPresetSessionRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return sendValidationError(
        res,
        'Invalid grouped workout payload.',
        parsedBody.error
      );
    }
    if (
      await isFutureManualEntryDate(
        req.userId,
        parsedBody.data.entry_date,
        parsedBody.data.source
      )
    ) {
      return res
        .status(400)
        .json({ error: 'entry_date cannot be in the future' });
    }
    const { session, created } =
      await exerciseService.createGroupedWorkoutSessionWithStatus(
        req.userId,
        req.originalUserId || req.userId,
        parsedBody.data
      );
    const response = presetSessionResponseSchema.parse(session);
    res.status(created ? 201 : 200).json(response);
  } catch (error) {
    log('error', 'Error creating grouped workout session:', error);
    handleRouteError(error, res, next);
  }
});
/**
 * @swagger
 * /exercise-preset-entries/{id}:
 *   get:
 *     summary: Get a grouped workout session by ID
 *     tags: [Fitness & Workouts]
 *     description: Returns the full nested grouped workout session, including child exercises and sets.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The grouped workout session.
 *       400:
 *         description: Invalid grouped workout ID.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Grouped workout session not found.
 */
router.get('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const parsedParams = presetEntryIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return sendValidationError(
        res,
        'Invalid grouped workout id.',
        parsedParams.error
      );
    }
    const groupedWorkout = await exerciseService.getGroupedWorkoutSessionById(
      req.userId,
      parsedParams.data.id
    );
    if (!groupedWorkout) {
      return res
        .status(404)
        .json({ message: 'Exercise preset entry not found.' });
    }
    const response = presetSessionResponseSchema.parse(groupedWorkout);
    res.status(200).json(response);
  } catch (error) {
    log(
      'error',
      `Error getting grouped workout session ${req.params.id}:`,
      error
    );
    handleRouteError(error, res, next);
  }
});
/**
 * @swagger
 * /exercise-preset-entries/{id}:
 *   put:
 *     summary: Update a grouped workout session
 *     tags: [Fitness & Workouts]
 *     description: Updates grouped workout header fields and, for manual, sparky, or workout plan sessions, can replace the child exercises array in one request. Returns the full nested grouped session payload.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The grouped workout session was updated successfully.
 *       400:
 *         description: Invalid request body or grouped workout ID.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Grouped workout session not found.
 *       409:
 *         description: Nested exercise edits are not supported for synced/imported grouped workouts.
 */
router.put('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const parsedParams = presetEntryIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return sendValidationError(
        res,
        'Invalid grouped workout id.',
        parsedParams.error
      );
    }
    const parsedBody = updatePresetSessionRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return sendValidationError(
        res,
        'Invalid grouped workout update payload.',
        parsedBody.error
      );
    }
    const groupedWorkout = await exerciseService.updateGroupedWorkoutSession(
      req.userId,

      req.originalUserId || req.userId,
      parsedParams.data.id,
      parsedBody.data
    );
    const response = presetSessionResponseSchema.parse(groupedWorkout);
    res.status(200).json(response);
  } catch (error) {
    log(
      'error',
      `Error updating grouped workout session ${req.params.id}:`,
      error
    );
    handleRouteError(error, res, next);
  }
});
/**
 * @swagger
 * /exercise-preset-entries/{id}:
 *   delete:
 *     summary: Delete a grouped workout session
 *     tags: [Fitness & Workouts]
 *     description: Deletes a grouped workout session and cascades to its child exercise entries.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       204:
 *         description: Grouped workout session deleted successfully.
 *       400:
 *         description: Invalid grouped workout ID.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Grouped workout session not found.
 */
router.delete('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const parsedParams = presetEntryIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return sendValidationError(
        res,
        'Invalid grouped workout id.',
        parsedParams.error
      );
    }
    const deleted =
      await exercisePresetEntryRepository.deleteExercisePresetEntry(
        parsedParams.data.id,

        req.userId
      );
    if (!deleted) {
      return res.status(404).json({
        message: 'Exercise preset entry not found or not authorized.',
      });
    }
    res.status(204).send();
  } catch (error) {
    log(
      'error',
      `Error deleting grouped workout session ${req.params.id}:`,
      error
    );
    next(error);
  }
});
export default router;
