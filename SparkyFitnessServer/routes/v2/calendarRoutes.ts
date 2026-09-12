import express, { RequestHandler } from 'express';
import {
  CreateCalendarFeedBodySchema,
  UpdateCalendarFeedBodySchema,
  AgendaQuerySchema,
} from '../../schemas/calendarSchemas.js';
import calendarFeedRepository from '../../models/calendarFeedRepository.js';
import calendarService, {
  InvalidIcsFeedError,
} from '../../services/calendarService.js';
import { loadUserTimezone } from '../../utils/timezoneLoader.js';
import {
  OutboundUrlBlockedError,
  OutboundUrlShapeError,
} from '../../utils/outboundUrlPolicy.js';

function handleFeedUrlError(
  res: express.Response,
  next: express.NextFunction,
  error: unknown
): void {
  if (
    error instanceof InvalidIcsFeedError ||
    error instanceof OutboundUrlShapeError ||
    error instanceof OutboundUrlBlockedError
  ) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

const router = express.Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Owner-only feature: no onBehalfOf / permission middleware. authMiddleware
// (mounted globally) supplies req.userId; RLS enforces owner-only access.

function badRequest(res: express.Response, error: unknown): void {
  res.status(400).json({
    error: 'Invalid request',
    details:
      error && typeof error === 'object' && 'flatten' in error
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any).flatten().fieldErrors
        : undefined,
  });
}

function requireUuid(res: express.Response, id: unknown): id is string {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid or missing id' });
    return false;
  }
  return true;
}

// --- Feeds --------------------------------------------------------------------

const listFeeds: RequestHandler = async (req, res, next) => {
  try {
    const feeds = await calendarFeedRepository.listFeeds(req.userId);
    res.json(feeds);
  } catch (error) {
    next(error);
  }
};

const postFeed: RequestHandler = async (req, res, next) => {
  try {
    const body = CreateCalendarFeedBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    // Reject a bad/unreachable/blocked URL immediately rather than saving it
    // and silently returning zero events on every later dashboard load.
    await calendarService.validateFeedUrl(body.data.ics_url);
    const saved = await calendarFeedRepository.createFeed(
      req.userId,
      body.data
    );
    res.status(201).json(saved);
  } catch (error) {
    handleFeedUrlError(res, next, error);
  }
};

const putFeed: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const body = UpdateCalendarFeedBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    if (body.data.ics_url) {
      await calendarService.validateFeedUrl(body.data.ics_url);
    }
    const updated = await calendarFeedRepository.updateFeed(
      req.userId,
      id!,
      body.data
    );
    if (!updated) {
      res.status(404).json({ error: 'Calendar feed not found' });
      return;
    }
    // An edited ics_url shouldn't wait out the 15-minute cache TTL before a
    // Day/Week refetch reflects it.
    if (body.data.ics_url) calendarService.invalidateFeedCache(id!);
    res.json(updated);
  } catch (error) {
    handleFeedUrlError(res, next, error);
  }
};

const deleteFeedHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const ok = await calendarFeedRepository.deleteFeed(req.userId, id!);
    if (!ok) {
      res.status(404).json({ error: 'Calendar feed not found' });
      return;
    }
    calendarService.invalidateFeedCache(id!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- Agenda ---------------------------------------------------------------

const getAgendaHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = AgendaQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const tz = await loadUserTimezone(req.userId);
    const events = await calendarService.getAgenda(
      req.userId,
      query.data.start,
      query.data.end,
      tz
    );
    res.json(events);
  } catch (error) {
    // Per-feed fetch/parse/policy failures are already caught and logged
    // inside getAgenda (one dead feed shouldn't blank the whole agenda) —
    // anything reaching here is a genuine unexpected error.
    next(error);
  }
};

router.get('/agenda', getAgendaHandler);

router.get('/feeds', listFeeds);
router.post('/feeds', postFeed);
router.put('/feeds/:id', putFeed);
router.delete('/feeds/:id', deleteFeedHandler);

export default router;
