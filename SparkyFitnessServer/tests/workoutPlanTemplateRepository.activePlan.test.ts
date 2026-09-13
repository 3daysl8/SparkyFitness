import { vi, beforeEach, describe, expect, it } from 'vitest';
import { getClient } from '../db/poolManager.js';
import workoutPlanTemplateRepository from '../models/workoutPlanTemplateRepository.js';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
  getSystemClient: vi.fn(),
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));
// pg-format isn't relevant to these assertions; the tests below never
// exercise the assignment/sets insert path.
vi.mock('pg-format', () => ({
  default: vi.fn((sql: string) => sql),
}));

const USER_ID = '99999999-9999-4999-8999-999999999999';
const TEMPLATE_ID = 42;

function makeClient() {
  const client = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: vi.fn(async (sql: string, params?: any[]) => {
      if (/INSERT INTO workout_plan_templates/.test(sql)) {
        return {
          rows: [
            {
              id: TEMPLATE_ID,
              user_id: USER_ID,
              plan_name: params?.[1],
              is_active: params?.[5],
            },
          ],
        };
      }
      if (/UPDATE workout_plan_templates SET is_active = false/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE workout_plan_templates SET/.test(sql)) {
        return { rows: [{ id: TEMPLATE_ID }] };
      }
      if (/SELECT id FROM workout_plan_template_assignments/.test(sql)) {
        return { rows: [] };
      }
      if (/FROM workout_plan_templates t/.test(sql)) {
        return { rows: [{ id: TEMPLATE_ID, assignments: [] }] };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  return client;
}

function deactivationCalls(client: ReturnType<typeof makeClient>) {
  return client.query.mock.calls.filter(([sql]) =>
    /UPDATE workout_plan_templates SET is_active = false/.test(sql)
  );
}

describe('workoutPlanTemplateRepository single-active-plan enforcement', () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    vi.mocked(getClient).mockResolvedValue(client);
  });

  describe('createWorkoutPlanTemplate', () => {
    it('deactivates other plans for the user when the new plan is active', async () => {
      await workoutPlanTemplateRepository.createWorkoutPlanTemplate({
        user_id: USER_ID,
        plan_name: 'New Active Plan',
        is_active: true,
      });

      const calls = deactivationCalls(client);
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual([USER_ID, TEMPLATE_ID]);
    });

    it('does not deactivate other plans when the new plan is not active', async () => {
      await workoutPlanTemplateRepository.createWorkoutPlanTemplate({
        user_id: USER_ID,
        plan_name: 'New Inactive Plan',
        is_active: false,
      });

      expect(deactivationCalls(client)).toHaveLength(0);
    });
  });

  describe('updateWorkoutPlanTemplate', () => {
    it('deactivates other plans for the user when activating this one', async () => {
      await workoutPlanTemplateRepository.updateWorkoutPlanTemplate(
        TEMPLATE_ID,
        USER_ID,
        { plan_name: 'Now Active', is_active: true }
      );

      const calls = deactivationCalls(client);
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual([USER_ID, TEMPLATE_ID]);
    });

    it('does not deactivate other plans when this one stays inactive', async () => {
      await workoutPlanTemplateRepository.updateWorkoutPlanTemplate(
        TEMPLATE_ID,
        USER_ID,
        { plan_name: 'Still Inactive', is_active: false }
      );

      expect(deactivationCalls(client)).toHaveLength(0);
    });
  });
});
