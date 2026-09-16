import express, { RequestHandler } from 'express';
import { z } from 'zod';
import checkPermissionMiddleware from '../../middleware/checkPermissionMiddleware.js';
import weeklyWorkoutGoalService from '../../services/weeklyWorkoutGoalService.js';
import {
  isDayString,
  weeklyWorkoutGoalProgressResponseSchema,
} from '@workspace/shared';

const router = express.Router();

// This reads the same exercise-session data (exercise_preset_entries /
// exercise_entries) as v2/exerciseEntryRoutes.ts and v2/plannedWorkoutRoutes.ts,
// both of which gate on the 'diary' tier (resolved to 'diary_read' for GET by
// checkPermissionMiddleware) rather than reportRoutes.ts's 'reports' tier —
// see canAccessUserData in utils/permissionUtils.ts for exactly how the two
// tiers differ. Deliberately its own router mounted ahead of reportRoutesV2 in
// SparkyFitnessServer.ts (both at '/api/v2/reports') rather than a route added
// inside reportRoutes.ts: an unconditional router.use(checkPermissionMiddleware
// ('reports')) applies to every request that enters that router regardless of
// whether any route inside it matches, so a route added there could not opt
// out of the 'reports' tier. No onBehalfOfMiddleware either, matching the same
// two diary-tier routers (unlike reportRoutes.ts, which does use it).
router.use(checkPermissionMiddleware('diary'));

const WeeklyWorkoutGoalQuerySchema = z.object({
  date: z.string().refine(isDayString, {
    message: 'Date must be in YYYY-MM-DD format',
  }),
});

/**
 * @swagger
 * /v2/reports/weekly-workout-goal:
 *   get:
 *     summary: Get weekly workout goal progress
 *     tags: [Fitness & Workouts]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Any date within the target week (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Weekly workout goal progress.
 *       400:
 *         description: Validation error.
 */
const getWeeklyWorkoutGoalHandler: RequestHandler = async (req, res, next) => {
  try {
    const queryResult = WeeklyWorkoutGoalQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation error',
        details: queryResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { date } = queryResult.data;
    const result = await weeklyWorkoutGoalService.getWeeklyWorkoutGoalProgress(
      req.userId,
      date
    );
    // Strict-parse the response so a shape drift between this service and the
    // shared wire schema fails loudly here instead of shipping silently.
    res.status(200).json(weeklyWorkoutGoalProgressResponseSchema.parse(result));
  } catch (error: unknown) {
    next(error);
  }
};

router.get('/weekly-workout-goal', getWeeklyWorkoutGoalHandler);

export default router;
