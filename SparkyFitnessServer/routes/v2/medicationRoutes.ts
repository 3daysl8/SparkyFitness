import express, { RequestHandler } from 'express';
import {
  CreateMedicationBodySchema,
  UpdateMedicationBodySchema,
  CreateScheduleBodySchema,
  UpdateScheduleBodySchema,
  MedicationIdParamSchema,
  ListMedicationsQuerySchema,
  CreateMedicationEntryBodySchema,
  UpdateMedicationEntryBodySchema,
  ListMedicationEntriesQuerySchema,
  UpdateMedicationDisplayPreferencesBodySchema,
  DisplayPreferenceParamsSchema,
} from '../../schemas/medicationSchemas.js';
import { UuidParamSchema } from '../../schemas/measurementSchemas.js';
import checkPermissionMiddleware from '../../middleware/checkPermissionMiddleware.js';
import { canAccessUserData } from '../../utils/permissionUtils.js';
import { getClient } from '../../db/poolManager.js';
import onBehalfOfMiddleware from '../../middleware/onBehalfOfMiddleware.js';
import medicationRepository from '../../models/medicationRepository.js';
import medicationEntryRepository from '../../models/medicationEntryRepository.js';
import medicationDisplayPreferenceRepository from '../../models/medicationDisplayPreferenceRepository.js';
import { loadUserTimezone } from '../../utils/timezoneLoader.js';
import { todayInZone } from '@workspace/shared';

const router = express.Router();

// Caregivers may manage a dependent's medications via the on-behalf-of header,
// gated by the 'diary' permission. Owners are unaffected.
router.use(onBehalfOfMiddleware);
router.use(checkPermissionMiddleware('medications'));

// A supplement's nutrient payload is nutrition data: once doses are logged it moves
// the owner's daily totals and report. Managing medications alone therefore does not
// authorise writing it, and the client hiding the editor is only an affordance — the
// API has to enforce this independently of the UI.
//
// Stripping rather than rejecting, because these are the same endpoints a caregiver
// legitimately uses to rename a supplement or fix its schedule.
//
// `is_supplement` is treated differently on the two verbs, and the asymmetry matters:
//   - create: the flag is KEPT. It is a classification, not nutrition, and a supplement
//     with no payload rolls nothing up. Dropping it would silently turn a caregiver's
//     "Add supplement" into a plain medication.
//   - update: the flag is STRIPPED, because setting it on a medication that already
//     carries a payload would start that payload counting — a way to enable nutrition
//     the caller may not write. updateMedication is a sparse patch, so omitting the
//     keys preserves whatever the owner already set.
const stripNutrientFieldsWithoutDiaryAccess = ({
  keepSupplementFlag,
}: {
  keepSupplementFlag: boolean;
}): RequestHandler => {
  return async (req, res, next) => {
    // dose_amount belongs in this set: the entry snapshot multiplies the nutrient
    // payload by it, so changing a supplement's dose changes future nutrition just
    // as editing the payload does.
    const touchesNutrition =
      req.body?.nutrients !== undefined ||
      req.body?.is_supplement !== undefined ||
      req.body?.dose_amount !== undefined;
    if (!touchesNutrition) return next();

    const authUserId =
      req.originalUserId || req.authenticatedUserId || req.userId;
    try {
      const allowed = await canAccessUserData(req.userId, 'diary', authUserId);
      if (!allowed) {
        // On update the body alone does not say whether the target is a supplement,
        // so resolve it: a bare dose_amount patch carries no is_supplement flag.
        const targetIsSupplement =
          req.body?.is_supplement === true ||
          (await resolveIsSupplement(req.userId, {
            medicationId: asUuid(oneParam(req.params.id)),
          }));
        delete req.body.nutrients;
        if (!keepSupplementFlag) delete req.body.is_supplement;
        if (targetIsSupplement) delete req.body.dose_amount;
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

// Logging a supplement dose is also a nutrition write: createEntry snapshots the
// medication's nutrient payload onto the entry, and the report multiplies it by the
// dose. Guarding only the medication create/update paths therefore leaves a side door
// open — a caregiver without diary access could log doses of a supplement the owner
// already set up, or change a dose so future entries scale differently.
//
// Rejecting rather than stripping here, unlike the medication paths: there is no
// harmless subset of "log this dose" to let through. Plain medications are unaffected,
// so a caregiver keeps full access to everything that is not a supplement.
// Route params are typed `string | string[]` here, so normalise before use.
const oneParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

// The guard below runs ahead of each route's own UuidParamSchema validation, and its
// lookups compare against uuid columns. A malformed id would therefore reach Postgres
// and raise instead of returning the route's normal 400, so ids are shape-checked here
// and anything invalid is passed straight through to that existing validation.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (value: string | undefined): string | undefined =>
  value !== undefined && UUID_RE.test(value) ? value : undefined;

const resolveIsSupplement = async (
  userId: string,
  {
    medicationId,
    entryId,
    scheduleId,
  }: { medicationId?: string; entryId?: string; scheduleId?: string }
): Promise<boolean> => {
  const client = await getClient(userId);
  try {
    if (scheduleId) {
      // A schedule's dose_amount becomes the entry's dose_amount_snapshot, which the
      // report multiplies the nutrient payload by, so editing it changes future
      // nutrition just as surely as editing the payload does.
      const res = await client.query(
        `SELECT m.is_supplement
           FROM medication_schedules ms
           JOIN medications m ON m.id = ms.medication_id
          WHERE ms.id = $1 AND ms.user_id = $2`,
        [scheduleId, userId]
      );
      return Boolean(res.rows[0]?.is_supplement);
    }
    if (entryId) {
      // LEFT JOIN, and the snapshot counts as much as the flag. medication_id is
      // ON DELETE SET NULL, so entries from a deleted supplement keep feeding the
      // report through nutrients_snapshot while having no medication row to read
      // is_supplement from. An inner join reports those orphans as non-supplements
      // and opens the gate on exactly the history it is meant to protect. The
      // snapshot is also the more honest test: it is what the report actually sums.
      const res = await client.query(
        `SELECT (m.is_supplement OR me.nutrients_snapshot IS NOT NULL)
                  AS is_supplement
           FROM medication_entries me
           LEFT JOIN medications m ON m.id = me.medication_id
          WHERE me.id = $1 AND me.user_id = $2`,
        [entryId, userId]
      );
      return Boolean(res.rows[0]?.is_supplement);
    }
    if (medicationId) {
      const res = await client.query(
        'SELECT is_supplement FROM medications WHERE id = $1 AND user_id = $2',
        [medicationId, userId]
      );
      return Boolean(res.rows[0]?.is_supplement);
    }
    return false;
  } finally {
    client.release();
  }
};

const requireDiaryForSupplementDose = (
  locate: (req: Parameters<RequestHandler>[0]) => {
    medicationId?: string;
    entryId?: string;
    scheduleId?: string;
  }
): RequestHandler => {
  return async (req, res, next) => {
    try {
      const target = locate(req);
      if (!target.medicationId && !target.entryId && !target.scheduleId)
        return next();
      const isSupplement = await resolveIsSupplement(req.userId, target);
      if (!isSupplement) return next();

      const authUserId =
        req.originalUserId || req.authenticatedUserId || req.userId;
      const allowed = await canAccessUserData(req.userId, 'diary', authUserId);
      if (!allowed) {
        res.status(403).json({
          error:
            'Managing supplement doses requires food diary access for this profile.',
        });
        return;
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * @swagger
 * tags:
 *   - name: Medications
 *     description: Medication cabinet, schedules, and adherence/dose logging.
 *
 * /v2/medications:
 *   get:
 *     summary: List the user's medications
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: A list of medications. }
 *   post:
 *     summary: Create a medication
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string }, is_supplement: { type: boolean }, nutrients: { type: object, description: Fixed-key and custom nutrient amounts per dose }, type_id: { type: string }, strength_value: { type: number }, strength_unit: { type: string } } }
 *     responses:
 *       201: { description: Created. }
 *       400: { description: Invalid request. }
 *
 * /v2/medications/{id}:
 *   get:
 *     summary: Get a medication (with schedules)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: The medication. }
 *       404: { description: Not found. }
 *   put:
 *     summary: Update a medication (partial)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Updated. }
 *       404: { description: Not found. }
 *   delete:
 *     summary: Delete a medication (cascades)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       204: { description: Deleted. }
 *       404: { description: Not found. }
 *
 * /v2/medications/{medicationId}/schedules:
 *   post:
 *     summary: Add a schedule rule to a medication
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: medicationId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 201: { description: Created. }, 400: { description: Invalid request. }, 403: { description: Supplement doses require food diary access for this profile. } }
 * /v2/medications/schedules/{id}:
 *   put:
 *     summary: Update a schedule rule (partial)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated. }, 400: { description: Invalid request. }, 404: { description: Not found. } }
 *   delete:
 *     summary: Delete a schedule rule
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 204: { description: Deleted. }, 404: { description: Not found. } }
 *
 * /v2/medications/entries:
 *   get:
 *     summary: List logged adherence doses
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: query, name: fromDate, schema: { type: string, format: date } }
 *       - { in: query, name: toDate, schema: { type: string, format: date } }
 *       - { in: query, name: medicationId, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Logged doses (adherence entries + injections). } }
 *   post:
 *     summary: Log an adherence dose (taken/skipped/snoozed/prn_taken)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [medication_id], properties: { medication_id: { type: string, format: uuid }, schedule_id: { type: string, format: uuid }, status: { type: string, enum: [taken, skipped, snoozed, prn_taken] }, taken_at: { type: string, format: date-time }, entry_date: { type: string, format: date }, notes: { type: string } } }
 *     responses: { 201: { description: Created. }, 400: { description: Invalid request. }, 403: { description: Supplement doses require food diary access for this profile. } }
 * /v2/medications/entries/{id}:
 *   put:
 *     summary: Update a logged dose (e.g. correct the taken-at time or notes)
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { status: { type: string, enum: [taken, skipped, snoozed, prn_taken] }, taken_at: { type: string, format: date-time }, scheduled_for: { type: string, format: date-time }, entry_date: { type: string, format: date }, notes: { type: string } } }
 *     responses: { 200: { description: Updated. }, 404: { description: Not found. }, 403: { description: Supplement doses require food diary access for this profile. } }
 *   delete:
 *     summary: Delete a logged dose
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 204: { description: Deleted. }, 404: { description: Not found. }, 403: { description: Supplement doses require food diary access for this profile. } }
 *
 * /v2/medications/display-preferences:
 *   get:
 *     summary: List the user's medication display preferences
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     responses: { 200: { description: Display preferences per view group and platform. } }
 * /v2/medications/display-preferences/{viewGroup}/{platform}:
 *   put:
 *     summary: Upsert the visible items for a view group and platform
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: viewGroup, required: true, schema: { type: string } }
 *       - { in: path, name: platform, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [visible_items], properties: { visible_items: { type: array, items: { type: string } } } }
 *     responses: { 200: { description: Upserted preference. }, 400: { description: Invalid request. } }
 *   delete:
 *     summary: Delete a display preference for a view group and platform
 *     tags: [Medications]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: viewGroup, required: true, schema: { type: string } }
 *       - { in: path, name: platform, required: true, schema: { type: string } }
 *     responses: { 204: { description: Deleted. }, 404: { description: Not found. } }
 */

// Small helper to send a uniform 400 for Zod failures.
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

// --- Medications ----------------------------------------------------------

const listMedications: RequestHandler = async (req, res, next) => {
  try {
    const query = ListMedicationsQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const meds = await medicationRepository.listMedications(req.userId, {
      activeOnly: query.data.activeOnly,
    });
    res.json(meds);
  } catch (error) {
    next(error);
  }
};

const createMedication: RequestHandler = async (req, res, next) => {
  try {
    const body = CreateMedicationBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const med = await medicationRepository.createMedication(
      req.userId,
      body.data
    );
    res.status(201).json(med);
  } catch (error) {
    next(error);
  }
};

const getMedication: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const med = await medicationRepository.getMedicationById(
      req.userId,
      params.data.id
    );
    if (!med) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    res.json(med);
  } catch (error) {
    next(error);
  }
};

const updateMedication: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = UpdateMedicationBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const med = await medicationRepository.updateMedication(
      req.userId,
      params.data.id,
      body.data
    );
    if (!med) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    res.json(med);
  } catch (error) {
    next(error);
  }
};

const deleteMedication: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const ok = await medicationRepository.deleteMedication(
      req.userId,
      params.data.id
    );
    if (!ok) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// --- Medication Entries (Adherence) ---------------------------------------

const listEntries: RequestHandler = async (req, res, next) => {
  try {
    const query = ListMedicationEntriesQuerySchema.safeParse(req.query);
    if (!query.success) return badRequest(res, query.error);
    const entries = await medicationEntryRepository.listEntriesWithInjections(
      req.userId,
      {
        fromDate: query.data.fromDate ?? undefined,
        toDate: query.data.toDate ?? undefined,
        medicationId: query.data.medicationId ?? undefined,
      }
    );
    res.json(entries);
  } catch (error) {
    next(error);
  }
};

const createEntry: RequestHandler = async (req, res, next) => {
  try {
    const body = CreateMedicationEntryBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    // Resolve timezone-aware defaults so we don't fall back to UTC CURRENT_DATE
    if (!body.data.entry_date) {
      const tz = await loadUserTimezone(req.userId);
      body.data.entry_date = todayInZone(tz);
    }
    if (!body.data.taken_at) {
      body.data.taken_at = new Date().toISOString();
    }
    const entry = await medicationEntryRepository.createEntry(
      req.userId,
      body.data
    );
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};

const updateEntry: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = UpdateMedicationEntryBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const entry = await medicationEntryRepository.updateEntry(
      req.userId,
      params.data.id,
      body.data
    );
    if (!entry) {
      res.status(404).json({ error: 'Medication entry not found' });
      return;
    }
    res.json(entry);
  } catch (error) {
    next(error);
  }
};

const deleteEntry: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const ok = await medicationEntryRepository.deleteEntry(
      req.userId,
      params.data.id
    );
    if (!ok) {
      res.status(404).json({ error: 'Medication entry not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

router.get('/', listMedications);
router.post(
  '/',
  stripNutrientFieldsWithoutDiaryAccess({ keepSupplementFlag: true }),
  createMedication
);
router.get('/entries', listEntries);
router.post(
  '/entries',
  requireDiaryForSupplementDose((req) => ({
    medicationId: asUuid(req.body?.medication_id as string | undefined),
  })),
  createEntry
);
router.put(
  '/entries/:id',
  requireDiaryForSupplementDose((req) => ({
    entryId: asUuid(oneParam(req.params.id)),
  })),
  updateEntry
);
router.delete(
  '/entries/:id',
  requireDiaryForSupplementDose((req) => ({
    entryId: asUuid(oneParam(req.params.id)),
  })),
  deleteEntry
);
// --- Display Preferences --------------------------------------------------

const getDisplayPreferences: RequestHandler = async (req, res, next) => {
  try {
    const prefs =
      await medicationDisplayPreferenceRepository.getMedicationDisplayPreferences(
        req.userId
      );
    res.json(prefs);
  } catch (error) {
    next(error);
  }
};

const upsertDisplayPreference: RequestHandler = async (req, res, next) => {
  try {
    const params = DisplayPreferenceParamsSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = UpdateMedicationDisplayPreferencesBodySchema.safeParse(
      req.body
    );
    if (!body.success) return badRequest(res, body.error);
    const pref =
      await medicationDisplayPreferenceRepository.upsertMedicationDisplayPreference(
        req.userId,
        params.data.viewGroup,
        params.data.platform,
        body.data.visible_items
      );
    res.json(pref);
  } catch (error) {
    next(error);
  }
};

const deleteDisplayPreference: RequestHandler = async (req, res, next) => {
  try {
    const params = DisplayPreferenceParamsSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const ok =
      await medicationDisplayPreferenceRepository.deleteMedicationDisplayPreference(
        req.userId,
        params.data.viewGroup,
        params.data.platform
      );
    if (!ok) {
      res.status(404).json({ error: 'Display preference not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

router.get('/display-preferences', getDisplayPreferences);
router.put(
  '/display-preferences/:viewGroup/:platform',
  upsertDisplayPreference
);
router.delete(
  '/display-preferences/:viewGroup/:platform',
  deleteDisplayPreference
);

router.get('/:id', getMedication);
router.put(
  '/:id',
  stripNutrientFieldsWithoutDiaryAccess({ keepSupplementFlag: false }),
  updateMedication
);
router.delete('/:id', deleteMedication);

// --- Schedules ------------------------------------------------------------

const addSchedule: RequestHandler = async (req, res, next) => {
  try {
    const params = MedicationIdParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = CreateScheduleBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const schedule = await medicationRepository.addSchedule(
      req.userId,
      params.data.medicationId,
      body.data
    );
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

const updateSchedule: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const body = UpdateScheduleBodySchema.safeParse(req.body);
    if (!body.success) return badRequest(res, body.error);
    const schedule = await medicationRepository.updateSchedule(
      req.userId,
      params.data.id,
      body.data
    );
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    next(error);
  }
};

const deleteSchedule: RequestHandler = async (req, res, next) => {
  try {
    const params = UuidParamSchema.safeParse(req.params);
    if (!params.success) return badRequest(res, params.error);
    const ok = await medicationRepository.deleteSchedule(
      req.userId,
      params.data.id
    );
    if (!ok) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

router.post(
  '/:medicationId/schedules',
  requireDiaryForSupplementDose((req) => ({
    medicationId: asUuid(oneParam(req.params.medicationId)),
  })),
  addSchedule
);
router.put(
  '/schedules/:id',
  requireDiaryForSupplementDose((req) => ({
    scheduleId: asUuid(oneParam(req.params.id)),
  })),
  updateSchedule
);
router.delete(
  '/schedules/:id',
  // Deleting a schedule drops its dose override, so future entries fall back to the
  // medication dose. That changes the multiplier applied to a supplement's nutrients
  // just as editing it does, so it carries the same gate.
  requireDiaryForSupplementDose((req) => ({
    scheduleId: asUuid(oneParam(req.params.id)),
  })),
  deleteSchedule
);

export default router;
