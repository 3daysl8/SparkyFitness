import express, { Request, RequestHandler } from 'express';
import { getDailySummaryRange } from '../services/dailySummaryRangeService.js';

import { z } from 'zod';
import checkPermissionMiddleware from '../middleware/checkPermissionMiddleware.js';
import { canAccessUserData } from '../utils/permissionUtils.js';

const router = express.Router();

router.use(checkPermissionMiddleware('diary'));

/**
 * Bounds the day loop and the response size. A year of report is already
 * far more than any chart renders legibly.
 */
const MAX_RANGE_DAYS = 366;

const MS_PER_DAY = 86_400_000;

/**
 * `z.iso.date()` rather than a digit-shape regex: the regex accepts calendar-invalid
 * values like 2026-13-45, whose `Date.parse` is NaN. That made the span check compare
 * against NaN (always false) and handed an unparseable day string to the service, which
 * threw a RangeError -- a 500 for what is plainly a bad request.
 */
const rangeQuerySchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    // Rejected here rather than reaching `canAccessUserData` and the repositories with
    // a value that can never identify a user.
    userId: z.uuid().optional(),
  })
  .refine((q) => q.startDate <= q.endDate, {
    message: 'startDate must not be after endDate',
    path: ['startDate'],
  })
  .refine(
    (q) =>
      Math.round(
        (Date.parse(`${q.endDate}T00:00:00Z`) -
          Date.parse(`${q.startDate}T00:00:00Z`)) /
          MS_PER_DAY
      ) +
        1 <=
      MAX_RANGE_DAYS,
    {
      message: `Date range must not exceed ${MAX_RANGE_DAYS} days`,
      path: ['endDate'],
    }
  );

interface SummaryAccess {
  actorUserId: string;
  targetUserId: string;
  /**
   * Whether check-in data may be read. Water intake, step calories and external BMR all
   * derive from `check_in_measurements` and require the `checkin` permission, not
   * `diary`.
   */
  includeCheckin: boolean;
}

async function resolveSummaryAccess(
  req: Request
): Promise<SummaryAccess | null> {
  const queryUserId = req.query.userId as string | undefined;
  const targetUserId = queryUserId || req.userId;
  const actorUserId = req.originalUserId || req.userId;

  // Family access: either explicit ?userId param, or onBehalfOfMiddleware
  // rewrote req.userId via sparky_active_user_id header.
  const isFamilyAccess = targetUserId !== actorUserId;

  if (!isFamilyAccess) {
    return { actorUserId, targetUserId, includeCheckin: true };
  }

  const hasPermission = await canAccessUserData(
    targetUserId,
    'diary',
    actorUserId
  );
  if (!hasPermission) return null;

  const includeCheckin = await canAccessUserData(
    targetUserId,
    'checkin',
    actorUserId
  );

  return { actorUserId, targetUserId, includeCheckin };
}

/**
 * @swagger
 * /daily-summary/range:
 *   get:
 *     summary: Get per-day calorie balance for a date range
 *     tags: [Dashboard]
 *     description: >
 *       Returns one calorie-balance row per day. Reports uses this instead of deriving
 *       the balance in the browser, which is what caused issue #2094.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-08-06"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-08-20"
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional user ID for family access
 *     responses:
 *       200:
 *         description: One calorie-balance row per calendar day in the range
 *       400:
 *         description: Missing/invalid dates, inverted range, or range longer than 366 days
 *       403:
 *         description: User does not have permission to access this resource
 *       500:
 *         description: Internal server error
 */
const rangeHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = rangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
      return;
    }
    const { startDate, endDate } = parsed.data;

    const access = await resolveSummaryAccess(req);
    if (!access) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const result = await getDailySummaryRange({
      actorUserId: access.actorUserId,
      targetUserId: access.targetUserId,
      startDate,
      endDate,
      includeCheckin: access.includeCheckin,
    });
    res.status(200).json(result);
  } catch (error: unknown) {
    next(error);
  }
};

// The single-date `/` route (GET /api/daily-summary) was deleted along with
// services/dailySummaryService.ts: food/nutrition tracking was hard-deleted
// from this fork, and that route's only consumer was the frontend's
// Diary.tsx/DailyProgress.tsx (also being removed). Only the ranged path
// survives -- it backs the still-live Reports page.
router.get('/range', rangeHandler);

export default router;
