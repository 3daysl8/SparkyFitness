import express, { RequestHandler } from 'express';
import {
  UpsertFocusDomainBodySchema,
  CreateFocusBodySchema,
  UpdateFocusBodySchema,
  ListFocusQuerySchema,
  UpsertFocusCheckinBodySchema,
  DateParamSchema,
  ListCheckinsQuerySchema,
  TodayQuerySchema,
} from '../../schemas/focusSchemas.js';
import focusRepository from '../../models/focusRepository.js';
import focusService from '../../services/focusService.js';
import { loadUserTimezone } from '../../utils/timezoneLoader.js';
import { todayInZone } from '@workspace/shared';

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

// --- Domains ------------------------------------------------------------------

const listDomains: RequestHandler = async (req, res, next) => {
  try {
    const domains = await focusRepository.listDomains(req.userId);
    res.json(domains);
  } catch (error) {
    next(error);
  }
};

const postDomain: RequestHandler = async (req, res, next) => {
  try {
    const body = UpsertFocusDomainBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const saved = await focusRepository.createDomain(req.userId, body.data);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
};

const putDomain: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const body = UpsertFocusDomainBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const updated = await focusRepository.updateDomain(
      req.userId,
      id!,
      body.data
    );
    if (!updated) {
      res.status(404).json({ error: 'Focus domain not found' });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteDomainHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const ok = await focusRepository.deleteDomain(req.userId, id!);
    if (!ok) {
      res.status(404).json({ error: 'Focus domain not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- Focuses ------------------------------------------------------------------

const listFocuses: RequestHandler = async (req, res, next) => {
  try {
    const query = ListFocusQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const focuses = await focusRepository.listFocuses(req.userId, {
      timeframe: query.data.timeframe,
      domainId: query.data.domain_id,
      status: query.data.status,
    });
    res.json(focuses);
  } catch (error) {
    next(error);
  }
};

const getFocusHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const focus = await focusRepository.getFocus(req.userId, id!);
    if (!focus) {
      res.status(404).json({ error: 'Focus not found' });
      return;
    }
    res.json(focus);
  } catch (error) {
    next(error);
  }
};

const postFocus: RequestHandler = async (req, res, next) => {
  try {
    const body = CreateFocusBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const saved = await focusRepository.createFocus(req.userId, body.data);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
};

const putFocus: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const body = UpdateFocusBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const updated = await focusRepository.updateFocus(
      req.userId,
      id!,
      body.data
    );
    if (!updated) {
      res.status(404).json({ error: 'Focus not found' });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteFocusHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const ok = await focusRepository.deleteFocus(req.userId, id!);
    if (!ok) {
      res.status(404).json({ error: 'Focus not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- Check-ins ------------------------------------------------------------------

const listCheckins: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const query = ListCheckinsQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const checkins = await focusRepository.listCheckins(req.userId, id!, {
      startDate: query.data.startDate,
      endDate: query.data.endDate,
    });
    res.json(checkins);
  } catch (error) {
    next(error);
  }
};

const putCheckin: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const params = DateParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = UpsertFocusCheckinBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const saved = await focusRepository.upsertCheckin(
      req.userId,
      id!,
      params.data.date,
      body.data
    );
    res.json(saved);
  } catch (error) {
    next(error);
  }
};

const deleteCheckinHandler: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!requireUuid(res, id)) return;
    const params = DateParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const ok = await focusRepository.deleteCheckin(
      req.userId,
      id!,
      params.data.date
    );
    if (!ok) {
      res.status(404).json({ error: 'Check-in not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- Today snapshot ---------------------------------------------------------

const getTodayHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = TodayQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const tz = await loadUserTimezone(req.userId);
    const date = query.data.date || todayInZone(tz);
    const snapshot = await focusService.getToday(req.userId, date);
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
};

router.get('/domains', listDomains);
router.post('/domains', postDomain);
router.put('/domains/:id', putDomain);
router.delete('/domains/:id', deleteDomainHandler);

router.get('/today', getTodayHandler);

router.get('/', listFocuses);
router.post('/', postFocus);
router.get('/:id', getFocusHandler);
router.put('/:id', putFocus);
router.delete('/:id', deleteFocusHandler);

router.get('/:id/checkins', listCheckins);
router.put('/:id/checkins/:date', putCheckin);
router.delete('/:id/checkins/:date', deleteCheckinHandler);

export default router;
