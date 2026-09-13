import { vi, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import express from 'express';
import medicationRepository from '../models/medicationRepository.js';
import medicationEntryRepository from '../models/medicationEntryRepository.js';
import medicationDisplayPreferenceRepository from '../models/medicationDisplayPreferenceRepository.js';
import { canAccessUserData } from '../utils/permissionUtils.js';
import medicationRoutes from '../routes/v2/medicationRoutes.js';

vi.mock('../models/medicationRepository.js');
vi.mock('../models/medicationEntryRepository.js');
vi.mock('../models/medicationDisplayPreferenceRepository.js');
vi.mock('../utils/permissionUtils.js', () => ({
  canAccessUserData: vi.fn(),
}));

// resolveIsSupplement reads the medication's subtype directly, so steer it per-test.
const supplementLookup = { is_supplement: false };
// Records every statement the subtype resolver runs so a test can assert its shape.
const executedSql: string[] = [];
vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(async () => ({
    query: vi.fn(async (sql: string) => {
      executedSql.push(String(sql));
      return { rows: [supplementLookup] };
    }),
    release: vi.fn(),
  })),
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: vi.fn(
    () =>
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) =>
        next()
  ),
}));
vi.mock('../middleware/onBehalfOfMiddleware.js', () => ({
  default: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => next(),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn(async () => 'America/New_York'),
  resolveTemplateStartDay: vi.fn(async () => '2026-07-28'),
}));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.headers.cookie && req.headers.cookie.includes('userId=')) {
    const m = req.headers.cookie.match(/userId=([^;]+)/);
    if (m) req.userId = m[1];
  }
  next();
});
app.use('/api/v2/medications', medicationRoutes);

const UID = '550e8400-e29b-41d4-a716-446655440000';
const cookie = ['userId=testUser'];

describe('Medication Routes V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executedSql.length = 0;
    // Default to an actor who may write diary data (the ordinary self-serve case).
    vi.mocked(canAccessUserData).mockResolvedValue(true);
  });

  describe('GET /api/v2/medications', () => {
    it('lists medications for the user', async () => {
      const meds = [{ id: UID, name: 'Wegovy' }];
      vi.mocked(medicationRepository.listMedications).mockResolvedValue(meds);
      const res = await request(app)
        .get('/api/v2/medications')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(meds);
      expect(medicationRepository.listMedications).toHaveBeenCalledWith(
        'testUser',
        expect.any(Object)
      );
    });
  });

  describe('POST /api/v2/medications', () => {
    it('creates a medication', async () => {
      const created = { id: UID, name: 'Wegovy' };
      vi.mocked(medicationRepository.createMedication).mockResolvedValue(
        created
      );
      const res = await request(app)
        .post('/api/v2/medications')
        .set('Cookie', cookie)
        .send({
          name: 'Wegovy',
          strength_value: 1,
          strength_unit: 'mg',
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(created);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/v2/medications')
        .set('Cookie', cookie)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid request');
    });

    // A supplement's nutrient payload feeds the owner's daily nutrition totals, so
    // writing it needs diary permission on top of the medication permission that
    // guards this router. The client hides the editor, but that is only an
    // affordance — these cases pin the server-side half.
    it('keeps nutrient fields when the actor has diary access', async () => {
      vi.mocked(canAccessUserData).mockResolvedValue(true);
      vi.mocked(medicationRepository.createMedication).mockResolvedValue({
        id: UID,
        name: 'Vitamin D',
      });

      await request(app)
        .post('/api/v2/medications')
        .set('Cookie', cookie)
        .send({
          name: 'Vitamin D',
          is_supplement: true,
          nutrients: { custom_nutrients: { 'Vitamin D': 25 } },
        });

      const body = vi.mocked(medicationRepository.createMedication).mock
        .calls[0][1];
      expect(body).toMatchObject({
        is_supplement: true,
        nutrients: { custom_nutrients: { 'Vitamin D': 25 } },
      });
    });

    it('strips nutrient fields when the actor lacks diary access', async () => {
      vi.mocked(canAccessUserData).mockResolvedValue(false);
      vi.mocked(medicationRepository.createMedication).mockResolvedValue({
        id: UID,
        name: 'Vitamin D',
      });

      const res = await request(app)
        .post('/api/v2/medications')
        .set('Cookie', cookie)
        .send({
          name: 'Vitamin D',
          is_supplement: true,
          nutrients: { calories: 500 },
        });

      // Stripped rather than rejected: the caregiver may still manage the
      // medication itself, they just cannot attach nutrition to it.
      expect(res.statusCode).toBe(201);
      const body = vi.mocked(medicationRepository.createMedication).mock
        .calls[0][1];
      expect(body).not.toHaveProperty('nutrients');
      // The classification is KEPT on create: it is not nutrition, a supplement with
      // no payload rolls nothing up, and dropping it would silently turn the
      // caregiver's "Add supplement" into a plain medication.
      expect(body).toMatchObject({ name: 'Vitamin D', is_supplement: true });
    });

    it('strips the supplement flag on UPDATE when the actor lacks diary access', async () => {
      vi.mocked(canAccessUserData).mockResolvedValue(false);
      vi.mocked(medicationRepository.updateMedication).mockResolvedValue({
        id: UID,
        name: 'Vitamin D',
      });

      // Unlike create, setting the flag on an existing medication could switch on a
      // nutrient payload the owner already stored — nutrition this caller may not write.
      await request(app)
        .put(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie)
        .send({ is_supplement: true, nutrients: { calories: 500 } });

      const body = vi.mocked(medicationRepository.updateMedication).mock
        .calls[0][2];
      expect(body).not.toHaveProperty('nutrients');
      expect(body).not.toHaveProperty('is_supplement');
    });

    it('rejects logging a supplement dose without diary access', async () => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/v2/medications/entries')
        .set('Cookie', cookie)
        .send({ medication_id: UID, status: 'taken' });

      // Rejected, not stripped: there is no harmless subset of "log this dose",
      // and createEntry would snapshot the nutrients server-side regardless.
      expect(res.statusCode).toBe(403);
      expect(medicationEntryRepository.createEntry).not.toHaveBeenCalled();
      // The gate must ask for diary specifically — asking for 'medications' would
      // always pass here and silently reopen the hole.
      expect(canAccessUserData).toHaveBeenCalledWith(
        expect.anything(),
        'diary',
        expect.anything()
      );
    });

    it('allows logging a supplement dose with diary access', async () => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(true);
      vi.mocked(medicationEntryRepository.createEntry).mockResolvedValue({
        id: UID,
      });

      const res = await request(app)
        .post('/api/v2/medications/entries')
        .set('Cookie', cookie)
        .send({ medication_id: UID, status: 'taken' });

      expect(res.statusCode).toBe(201);
      expect(canAccessUserData).toHaveBeenCalledWith(
        expect.anything(),
        'diary',
        expect.anything()
      );
    });

    it('rejects a supplement schedule dose change without diary access', async () => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(false);

      // A schedule's dose_amount becomes the entry's dose_amount_snapshot, which the
      // report multiplies the nutrient payload by, so this is a nutrition write too.
      const res = await request(app)
        .put(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie)
        .send({ dose_amount: 3 });

      expect(res.statusCode).toBe(403);
      expect(medicationRepository.updateSchedule).not.toHaveBeenCalled();
      expect(canAccessUserData).toHaveBeenCalledWith(
        expect.anything(),
        'diary',
        expect.anything()
      );
    });

    // The guard runs ahead of each route's UuidParamSchema and its lookups compare
    // against uuid columns, so a malformed id must not reach the database. It should
    // fall through to the route's own validation and still produce a 400.
    it.each([
      ['put', '/api/v2/medications/schedules/not-a-uuid'],
      ['delete', '/api/v2/medications/schedules/not-a-uuid'],
      ['put', '/api/v2/medications/entries/not-a-uuid'],
    ])('returns 400 for a malformed id on %s %s', async (method, url) => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(false);

      const res = await (method === 'put'
        ? request(app).put(url).set('Cookie', cookie).send({ dose_amount: 3 })
        : request(app).delete(url).set('Cookie', cookie));

      expect(res.statusCode).toBe(400);
      expect(canAccessUserData).not.toHaveBeenCalled();
    });

    it('treats an orphaned entry as a supplement via its snapshot', async () => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(false);

      await request(app)
        .put(`/api/v2/medications/entries/${UID}`)
        .set('Cookie', cookie)
        .send({ status: 'skipped' });

      // medication_id is ON DELETE SET NULL, so an entry whose supplement was
      // deleted has no medication row to read is_supplement from while still
      // feeding the report through its snapshot. An inner join would report it as
      // a plain medication and open the gate on exactly that history.
      expect(executedSql.some((q) => q.includes('LEFT JOIN medications'))).toBe(
        true
      );
      expect(
        executedSql.some((q) => q.includes('me.nutrients_snapshot IS NOT NULL'))
      ).toBe(true);
    });

    it('strips dose_amount when updating a supplement without diary access', async () => {
      supplementLookup.is_supplement = true;
      vi.mocked(canAccessUserData).mockResolvedValue(false);
      vi.mocked(medicationRepository.updateMedication).mockResolvedValue({
        id: UID,
      });

      // The entry snapshot multiplies the payload by dose_amount, so a bare dose
      // patch is a nutrition write even with no nutrients in the body.
      await request(app)
        .put(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie)
        .send({ dose_amount: 3, name: 'Vitamin D' });

      const body = vi.mocked(medicationRepository.updateMedication).mock
        .calls[0][2];
      expect(body).not.toHaveProperty('dose_amount');
      expect(body).toMatchObject({ name: 'Vitamin D' });
    });

    it('leaves plain medication dose logging ungated', async () => {
      supplementLookup.is_supplement = false;
      vi.mocked(canAccessUserData).mockResolvedValue(false);
      vi.mocked(medicationEntryRepository.createEntry).mockResolvedValue({
        id: UID,
      });

      const res = await request(app)
        .post('/api/v2/medications/entries')
        .set('Cookie', cookie)
        .send({ medication_id: UID, status: 'taken' });

      expect(res.statusCode).toBe(201);
    });

    it('does not consult diary permission for a plain medication', async () => {
      vi.mocked(medicationRepository.createMedication).mockResolvedValue({
        id: UID,
        name: 'Metformin',
      });

      await request(app)
        .post('/api/v2/medications')
        .set('Cookie', cookie)
        .send({ name: 'Metformin' });

      expect(canAccessUserData).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v2/medications/:id', () => {
    it('returns a medication', async () => {
      const med = { id: UID, name: 'Wegovy', schedules: [] };
      vi.mocked(medicationRepository.getMedicationById).mockResolvedValue(med);
      const res = await request(app)
        .get(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(med);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(medicationRepository.getMedicationById).mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for an invalid uuid', async () => {
      const res = await request(app)
        .get('/api/v2/medications/not-a-uuid')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v2/medications/:id', () => {
    it('deletes and returns 204', async () => {
      vi.mocked(medicationRepository.deleteMedication).mockResolvedValue(true);
      const res = await request(app)
        .delete(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when nothing deleted', async () => {
      vi.mocked(medicationRepository.deleteMedication).mockResolvedValue(false);
      const res = await request(app)
        .delete(`/api/v2/medications/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Schedules', () => {
    it('adds a schedule', async () => {
      const schedule = { id: 'sched-1', schedule_type_id: 'daily' };
      vi.mocked(medicationRepository.addSchedule).mockResolvedValue(schedule);
      const res = await request(app)
        .post(`/api/v2/medications/${UID}/schedules`)
        .set('Cookie', cookie)
        .send({ schedule_type_id: 'daily', time_of_day: '08:00' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(schedule);
      expect(medicationRepository.addSchedule).toHaveBeenCalledWith(
        'testUser',
        UID,
        expect.objectContaining({ schedule_type_id: 'daily' })
      );
    });

    it('accepts away_from_meals as a with_meal value', async () => {
      const schedule = { id: 'sched-2', schedule_type_id: 'daily' };
      vi.mocked(medicationRepository.addSchedule).mockResolvedValue(schedule);
      const res = await request(app)
        .post(`/api/v2/medications/${UID}/schedules`)
        .set('Cookie', cookie)
        .send({ schedule_type_id: 'daily', with_meal: 'away_from_meals' });
      expect(res.statusCode).toBe(201);
      expect(medicationRepository.addSchedule).toHaveBeenCalledWith(
        'testUser',
        UID,
        expect.objectContaining({ with_meal: 'away_from_meals' })
      );
    });

    it('rejects an invalid with_meal value', async () => {
      const res = await request(app)
        .post(`/api/v2/medications/${UID}/schedules`)
        .set('Cookie', cookie)
        .send({ schedule_type_id: 'daily', with_meal: 'bedtime' });
      expect(res.statusCode).toBe(400);
      expect(medicationRepository.addSchedule).not.toHaveBeenCalled();
    });

    it('returns 400 when schedule_type_id is missing on create', async () => {
      const res = await request(app)
        .post(`/api/v2/medications/${UID}/schedules`)
        .set('Cookie', cookie)
        .send({ time_of_day: '08:00' });
      expect(res.statusCode).toBe(400);
      expect(medicationRepository.addSchedule).not.toHaveBeenCalled();
    });

    it('updates a schedule, passing explicit-null discriminators through', async () => {
      const updated = { id: UID, schedule_type_id: 'daily' };
      vi.mocked(medicationRepository.updateSchedule).mockResolvedValue(updated);
      const res = await request(app)
        .put(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie)
        .send({
          schedule_type_id: 'daily',
          time_of_day: '09:00',
          dose_amount: 2,
          days_of_week: null,
          interval_days: null,
          day_of_month: null,
          cycle_on_days: null,
          cycle_off_days: null,
          with_meal: null,
          prn_reason: null,
          prn_max_per_day: null,
          start_date: null,
          end_date: null,
          active: true,
        });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(medicationRepository.updateSchedule).toHaveBeenCalledWith(
        'testUser',
        UID,
        expect.objectContaining({
          schedule_type_id: 'daily',
          time_of_day: '09:00',
          dose_amount: 2,
          days_of_week: null,
          interval_days: null,
          day_of_month: null,
          cycle_on_days: null,
          cycle_off_days: null,
          with_meal: null,
          prn_reason: null,
          prn_max_per_day: null,
          start_date: null,
          end_date: null,
          active: true,
        })
      );
    });

    it('returns 200 with the current row on an empty update', async () => {
      const current = { id: UID, schedule_type_id: 'weekly' };
      vi.mocked(medicationRepository.updateSchedule).mockResolvedValue(current);
      const res = await request(app)
        .put(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie)
        .send({});
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(current);
    });

    it('returns 404 when the schedule to update is missing', async () => {
      vi.mocked(medicationRepository.updateSchedule).mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie)
        .send({ time_of_day: '09:00' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when updating with an out-of-range weekday', async () => {
      const res = await request(app)
        .put(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie)
        .send({ days_of_week: [9] });
      expect(res.statusCode).toBe(400);
      expect(medicationRepository.updateSchedule).not.toHaveBeenCalled();
    });

    it('deletes a schedule', async () => {
      vi.mocked(medicationRepository.deleteSchedule).mockResolvedValue(true);
      const res = await request(app)
        .delete(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when the schedule to delete is missing', async () => {
      vi.mocked(medicationRepository.deleteSchedule).mockResolvedValue(false);
      const res = await request(app)
        .delete(`/api/v2/medications/schedules/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Entries', () => {
    // The injection_entries table (clinical/GLP-1 medication tracking) was
    // hard-deleted along with the food/goal/clinical-medication schema, so
    // listEntriesWithInjections is now a thin wrapper around medication_entries
    // that always reports entry_type: 'entry' (kept for API-shape compatibility
    // with callers that still read that field).
    it('lists medication entries', async () => {
      const entries = [
        {
          id: 'entry-1',
          medication_id: UID,
          status: 'taken',
          entry_type: 'entry',
        },
      ];
      vi.mocked(
        medicationEntryRepository.listEntriesWithInjections
      ).mockResolvedValue(entries);
      const res = await request(app)
        .get(
          '/api/v2/medications/entries?fromDate=2026-06-01&toDate=2026-06-30'
        )
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(entries);
      expect(
        medicationEntryRepository.listEntriesWithInjections
      ).toHaveBeenCalledWith(
        'testUser',
        expect.objectContaining({
          fromDate: '2026-06-01',
          toDate: '2026-06-30',
        })
      );
    });

    it('creates a medication entry', async () => {
      const entry = { id: 'entry-1', medication_id: UID, status: 'taken' };
      vi.mocked(medicationEntryRepository.createEntry).mockResolvedValue(entry);
      const res = await request(app)
        .post('/api/v2/medications/entries')
        .set('Cookie', cookie)
        .send({
          medication_id: UID,
          status: 'taken',
          entry_date: '2026-06-25',
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(entry);
    });

    it('returns 400 when creating with invalid status', async () => {
      const res = await request(app)
        .post('/api/v2/medications/entries')
        .set('Cookie', cookie)
        .send({
          medication_id: UID,
          status: 'invalid_status',
        });
      expect(res.statusCode).toBe(400);
    });

    it('updates an entry (edit the taken-at time)', async () => {
      const updated = {
        id: UID,
        medication_id: UID,
        status: 'prn_taken',
        taken_at: '2026-06-25T08:30:00.000Z',
      };
      vi.mocked(medicationEntryRepository.updateEntry).mockResolvedValue(
        updated
      );
      const res = await request(app)
        .put(`/api/v2/medications/entries/${UID}`)
        .set('Cookie', cookie)
        .send({
          taken_at: '2026-06-25T08:30:00.000Z',
          entry_date: '2026-06-25',
        });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(medicationEntryRepository.updateEntry).toHaveBeenCalledWith(
        'testUser',
        UID,
        expect.objectContaining({ taken_at: '2026-06-25T08:30:00.000Z' })
      );
    });

    it('returns 404 when the entry to update is missing', async () => {
      vi.mocked(medicationEntryRepository.updateEntry).mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/v2/medications/entries/${UID}`)
        .set('Cookie', cookie)
        .send({ notes: 'later' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when updating with an invalid status', async () => {
      const res = await request(app)
        .put(`/api/v2/medications/entries/${UID}`)
        .set('Cookie', cookie)
        .send({ status: 'bogus' });
      expect(res.statusCode).toBe(400);
    });

    it('deletes an entry', async () => {
      vi.mocked(medicationEntryRepository.deleteEntry).mockResolvedValue(true);
      const res = await request(app)
        .delete(`/api/v2/medications/entries/${UID}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(204);
    });
  });

  describe('Display Preferences', () => {
    it('lists display preferences', async () => {
      const prefs = [
        {
          id: 'pref-1',
          view_group: 'reports',
          platform: 'web',
          visible_items: ['a'],
        },
      ];
      vi.mocked(
        medicationDisplayPreferenceRepository.getMedicationDisplayPreferences
      ).mockResolvedValue(prefs);
      const res = await request(app)
        .get('/api/v2/medications/display-preferences')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(prefs);
    });

    it('upserts a display preference', async () => {
      const pref = {
        id: 'pref-1',
        view_group: 'reports',
        platform: 'web',
        visible_items: ['a'],
      };
      vi.mocked(
        medicationDisplayPreferenceRepository.upsertMedicationDisplayPreference
      ).mockResolvedValue(pref);
      const res = await request(app)
        .put('/api/v2/medications/display-preferences/reports/web')
        .set('Cookie', cookie)
        .send({ visible_items: ['a'] });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(pref);
      expect(
        medicationDisplayPreferenceRepository.upsertMedicationDisplayPreference
      ).toHaveBeenCalledWith('testUser', 'reports', 'web', ['a']);
    });

    it('deletes a display preference', async () => {
      vi.mocked(
        medicationDisplayPreferenceRepository.deleteMedicationDisplayPreference
      ).mockResolvedValue(true);
      const res = await request(app)
        .delete('/api/v2/medications/display-preferences/reports/web')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when display preference to delete is not found', async () => {
      vi.mocked(
        medicationDisplayPreferenceRepository.deleteMedicationDisplayPreference
      ).mockResolvedValue(false);
      const res = await request(app)
        .delete('/api/v2/medications/display-preferences/reports/web')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(404);
    });
  });
});
