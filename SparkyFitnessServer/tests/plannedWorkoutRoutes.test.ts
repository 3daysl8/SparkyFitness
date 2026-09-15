import { vi, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
// @ts-expect-error no supertest types
import request from 'supertest';
import plannedWorkoutService from '../services/plannedWorkoutService.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import plannedWorkoutRoutes from '../routes/v2/plannedWorkoutRoutes.js';

vi.mock('../services/plannedWorkoutService.js', () => ({
  default: {
    listPlannedWorkouts: vi.fn(),
    getDayView: vi.fn(),
    getPlannedWorkoutById: vi.fn(),
    createPlannedWorkout: vi.fn(),
    updatePlannedWorkout: vi.fn(),
    movePlannedWorkout: vi.fn(),
    startPlannedWorkout: vi.fn(),
    revertPlannedWorkout: vi.fn(),
    skipPlannedWorkout: vi.fn(),
    completePlannedWorkout: vi.fn(),
    deletePlannedWorkout: vi.fn(),
  },
}));

vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('UTC'),
}));

vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/logging.js', () => ({
  log: vi.fn(),
}));

const USER_ID = '99999999-9999-4999-8999-999999999999';
const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const rowFixture = {
  id: PLAN_ID,
  user_id: USER_ID,
  planned_date: '2026-07-10',
  planned_time: null,
  duration_estimate_minutes: null,
  title: 'Leg Day',
  workout_preset_id: null,
  exercise_id: null,
  workout_type: null,
  notes: null,
  status: 'planned' as const,
  is_missed: false,
  started_at: null,
  completed_at: null,
  completed_session_id: null,
  origin: 'manual' as const,
  template_id: null,
  assignment_id: null,
  generated_for_date: null,
  slot: null,
  user_modified: false,
  dismissed_at: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const app = express();
app.use(express.json());
app.use((req: import('express').Request, _res, next) => {
  (req as unknown as { userId: string }).userId = USER_ID;
  next();
});
app.use('/v2/planned-workouts', plannedWorkoutRoutes);

describe('plannedWorkoutRoutes (supertest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadUserTimezone).mockResolvedValue('UTC');
  });

  describe('GET /', () => {
    it('rejects a missing date range', async () => {
      const res = await request(app).get('/v2/planned-workouts');
      expect(res.status).toBe(400);
      expect(plannedWorkoutService.listPlannedWorkouts).not.toHaveBeenCalled();
    });

    it('returns the mapped list on success', async () => {
      vi.mocked(plannedWorkoutService.listPlannedWorkouts).mockResolvedValue([
        rowFixture,
      ]);

      const res = await request(app)
        .get('/v2/planned-workouts')
        .query({ from: '2026-07-01', to: '2026-07-31' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(PLAN_ID);
    });
  });

  describe('GET /day/:date', () => {
    it('rejects a malformed date', async () => {
      const res = await request(app).get('/v2/planned-workouts/day/not-a-date');
      expect(res.status).toBe(400);
    });

    it('returns for_date and missed arrays', async () => {
      vi.mocked(plannedWorkoutService.getDayView).mockResolvedValue({
        for_date: [rowFixture],
        missed: [],
      });

      const res = await request(app).get('/v2/planned-workouts/day/2026-07-10');

      expect(res.status).toBe(200);
      expect(res.body.for_date).toHaveLength(1);
      expect(res.body.missed).toHaveLength(0);
    });
  });

  describe('POST /', () => {
    it('rejects an invalid body', async () => {
      const res = await request(app)
        .post('/v2/planned-workouts')
        .send({ planned_date: '2026-07-10' }); // missing required title

      expect(res.status).toBe(400);
      expect(plannedWorkoutService.createPlannedWorkout).not.toHaveBeenCalled();
    });

    it('creates and returns 201 on success', async () => {
      vi.mocked(plannedWorkoutService.createPlannedWorkout).mockResolvedValue(
        rowFixture
      );

      const res = await request(app)
        .post('/v2/planned-workouts')
        .send({ planned_date: '2026-07-10', title: 'Leg Day' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Leg Day');
    });
  });

  describe('GET /:id', () => {
    it('rejects a non-UUID id', async () => {
      const res = await request(app).get('/v2/planned-workouts/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('maps a 404 service error to a 404 response', async () => {
      vi.mocked(plannedWorkoutService.getPlannedWorkoutById).mockRejectedValue(
        Object.assign(new Error('Planned workout not found.'), { status: 404 })
      );

      const res = await request(app).get(`/v2/planned-workouts/${PLAN_ID}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Planned workout not found.');
    });
  });

  describe('PATCH /:id', () => {
    it('rejects an empty patch body', async () => {
      const res = await request(app)
        .patch(`/v2/planned-workouts/${PLAN_ID}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('maps a 409 conflict from the service', async () => {
      vi.mocked(plannedWorkoutService.updatePlannedWorkout).mockRejectedValue(
        Object.assign(
          new Error('Cannot edit a plan that is already completed.'),
          {
            status: 409,
          }
        )
      );

      const res = await request(app)
        .patch(`/v2/planned-workouts/${PLAN_ID}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        'Cannot edit a plan that is already completed.'
      );
    });
  });

  describe('POST /:id/move', () => {
    it('requires planned_date', async () => {
      const res = await request(app)
        .post(`/v2/planned-workouts/${PLAN_ID}/move`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /:id/complete', () => {
    it('requires session_id', async () => {
      const res = await request(app)
        .post(`/v2/planned-workouts/${PLAN_ID}/complete`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('maps a 400 future-date refusal from the service', async () => {
      vi.mocked(plannedWorkoutService.completePlannedWorkout).mockRejectedValue(
        Object.assign(
          new Error('Cannot complete a plan dated in the future.'),
          {
            status: 400,
          }
        )
      );

      const res = await request(app)
        .post(`/v2/planned-workouts/${PLAN_ID}/complete`)
        .send({ session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /:id/revert', () => {
    it('returns the reverted plan on success', async () => {
      vi.mocked(plannedWorkoutService.revertPlannedWorkout).mockResolvedValue({
        ...rowFixture,
        status: 'planned',
        started_at: null,
      });

      const res = await request(app).post(
        `/v2/planned-workouts/${PLAN_ID}/revert`
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('planned');
    });

    it('maps a 409 refusal when the plan is not currently started', async () => {
      vi.mocked(plannedWorkoutService.revertPlannedWorkout).mockRejectedValue(
        Object.assign(
          new Error('Cannot revert a plan that is already completed.'),
          { status: 409 }
        )
      );

      const res = await request(app).post(
        `/v2/planned-workouts/${PLAN_ID}/revert`
      );

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        'Cannot revert a plan that is already completed.'
      );
    });

    it('rejects a non-UUID id', async () => {
      const res = await request(app).post(
        '/v2/planned-workouts/not-a-uuid/revert'
      );
      expect(res.status).toBe(400);
      expect(plannedWorkoutService.revertPlannedWorkout).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('returns the outcome message on success', async () => {
      vi.mocked(plannedWorkoutService.deletePlannedWorkout).mockResolvedValue({
        message: 'Planned workout deleted.',
      });

      const res = await request(app).delete(`/v2/planned-workouts/${PLAN_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Planned workout deleted.');
    });

    it('maps a 409 refusal', async () => {
      vi.mocked(plannedWorkoutService.deletePlannedWorkout).mockRejectedValue(
        Object.assign(
          new Error(
            'An in-progress plan cannot be deleted; skip or finish it first.'
          ),
          {
            status: 409,
          }
        )
      );

      const res = await request(app).delete(`/v2/planned-workouts/${PLAN_ID}`);

      expect(res.status).toBe(409);
    });
  });
});
