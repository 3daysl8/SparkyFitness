import { vi, beforeEach, describe, expect, it } from 'vitest';
import { buildFocusTools } from '../ai/tools/focusTools.js';
import focusRepository from '../models/focusRepository.js';
import { log } from '../config/logging.js';

vi.mock('../models/focusRepository', () => ({
  default: {
    listDomains: vi.fn(),
    createDomain: vi.fn(),
    listFocuses: vi.fn(),
    getFocus: vi.fn(),
    createFocus: vi.fn(),
    updateFocus: vi.fn(),
    deleteFocus: vi.fn(),
    upsertCheckin: vi.fn(),
    listCheckins: vi.fn(),
  },
}));
vi.mock('../services/focusService', () => ({
  default: { getToday: vi.fn() },
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));

const opts = { toolCallId: 'tc-1', messages: [] };
const FOCUS_ID = '55555555-5555-4555-8555-555555555555';

const focusRow = (overrides: Record<string, unknown> = {}) => ({
  id: FOCUS_ID,
  statement: 'Submit the quarterly report',
  timeframe: 'daily',
  target_type: 'none',
  target_value: null,
  unit: null,
  period_date: '2026-09-15',
  due_time: null,
  status: 'active',
  parent_focus_id: null,
  recurrence_days_of_week: null,
  recurrence_end_date: null,
  ...overrides,
});

let tools: ReturnType<typeof buildFocusTools>;

beforeEach(() => {
  vi.clearAllMocks();
  tools = buildFocusTools('user-1', 'UTC');
});

describe('sparky_manage_focus due_time', () => {
  it('passes due_time through on create and confirms it', async () => {
    vi.mocked(focusRepository.createFocus).mockResolvedValue(
      focusRow({ due_time: '18:00:00' })
    );

    const result = await tools.sparky_manage_focus.execute!(
      {
        action: 'create_focus',
        timeframe: 'daily',
        statement: 'Submit the quarterly report',
        period_date: '2026-09-15',
        due_time: '18:00',
      },
      opts
    );

    expect(focusRepository.createFocus).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        statement: 'Submit the quarterly report',
        period_date: '2026-09-15',
        due_time: '18:00',
      })
    );
    expect(result).toBe(
      `✅ Focus created: "Submit the quarterly report" (daily, due 18:00, ID: ${FOCUS_ID}).`
    );
    expect(log).toHaveBeenCalledWith(
      'info',
      `[Focus Tool] tool=sparky_manage_focus action=create_focus userId=user-1 focus_id=${FOCUS_ID}`
    );
  });

  it('keeps the original create confirmation when no due_time is set', async () => {
    vi.mocked(focusRepository.createFocus).mockResolvedValue(focusRow());

    const result = await tools.sparky_manage_focus.execute!(
      {
        action: 'create_focus',
        timeframe: 'daily',
        statement: 'Submit the quarterly report',
      },
      opts
    );

    expect(result).toBe(
      `✅ Focus created: "Submit the quarterly report" (daily, ID: ${FOCUS_ID}).`
    );
  });

  it('updates only due_time without touching other columns', async () => {
    vi.mocked(focusRepository.updateFocus).mockResolvedValue(
      focusRow({ due_time: '07:30:00' })
    );

    const result = await tools.sparky_manage_focus.execute!(
      { action: 'update_focus', focus_id: FOCUS_ID, due_time: '07:30' },
      opts
    );

    expect(focusRepository.updateFocus).toHaveBeenCalledWith(
      'user-1',
      FOCUS_ID,
      { due_time: '07:30' }
    );
    // The repository updates every key it is given, so omitted fields must
    // not be sent as undefined (they would be written as NULL).
    const patch = vi.mocked(focusRepository.updateFocus).mock.calls[0][2];
    expect(Object.keys(patch)).toEqual(['due_time']);
    expect(result).toBe(
      '✅ Focus updated: "Submit the quarterly report" (due 07:30).'
    );
  });

  it('clears due_time with null', async () => {
    vi.mocked(focusRepository.updateFocus).mockResolvedValue(focusRow());

    const result = await tools.sparky_manage_focus.execute!(
      { action: 'update_focus', focus_id: FOCUS_ID, due_time: null },
      opts
    );

    expect(focusRepository.updateFocus).toHaveBeenCalledWith(
      'user-1',
      FOCUS_ID,
      { due_time: null }
    );
    expect(result).toBe('✅ Focus updated: "Submit the quarterly report".');
  });

  it('infers update_focus from focus_id plus due_time', async () => {
    vi.mocked(focusRepository.updateFocus).mockResolvedValue(
      focusRow({ due_time: '09:00:00' })
    );

    await tools.sparky_manage_focus.execute!(
      { focus_id: FOCUS_ID, due_time: '09:00' },
      opts
    );

    expect(focusRepository.updateFocus).toHaveBeenCalledWith(
      'user-1',
      FOCUS_ID,
      { due_time: '09:00' }
    );
    expect(focusRepository.getFocus).not.toHaveBeenCalled();
  });

  it.each(['6pm', '24:00', '18:60', '6:00'])(
    'rejects an invalid due_time %s',
    async (dueTime) => {
      const result = await tools.sparky_manage_focus.execute!(
        {
          action: 'create_focus',
          timeframe: 'daily',
          statement: 'Submit the quarterly report',
          due_time: dueTime,
        },
        opts
      );

      expect(result).toBe(
        'Error [VALIDATION]: due_time: Due time must be in 24-hour HH:MM format (optionally HH:MM:SS).'
      );
      expect(focusRepository.createFocus).not.toHaveBeenCalled();
    }
  );

  it('rejects an invalid due_time on update', async () => {
    const result = await tools.sparky_manage_focus.execute!(
      { action: 'update_focus', focus_id: FOCUS_ID, due_time: '6pm' },
      opts
    );

    expect(result).toBe(
      'Error [VALIDATION]: due_time: Due time must be in 24-hour HH:MM format (optionally HH:MM:SS).'
    );
    expect(focusRepository.updateFocus).not.toHaveBeenCalled();
  });

  it('renders due_time in focus output', async () => {
    vi.mocked(focusRepository.getFocus).mockResolvedValue(
      focusRow({ due_time: '18:00:00' })
    );

    const result = await tools.sparky_manage_focus.execute!(
      { action: 'get_focus', focus_id: FOCUS_ID },
      opts
    );

    expect(result).toBe(
      `**Submit the quarterly report** (daily) | 2026-09-15 | due 18:00\n  ID: ${FOCUS_ID}`
    );
  });

  it('renders due_time in list output', async () => {
    vi.mocked(focusRepository.listFocuses).mockResolvedValue([
      focusRow({ due_time: '18:00:00' }),
    ]);

    const result = await tools.sparky_manage_focus.execute!(
      { action: 'list_focuses', timeframe: 'daily' },
      opts
    );

    expect(result).toBe(
      `# Focuses\n\n**Submit the quarterly report** (daily) | 2026-09-15 | due 18:00\n  ID: ${FOCUS_ID}`
    );
  });
});
