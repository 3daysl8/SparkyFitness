import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HabitCard from '@/pages/Home/HabitCard';
import type { RecurringFocus, FocusDomain } from '@/types/focus';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    timezone: 'UTC',
    firstDayOfWeek: 0,
  }),
}));

const mockCreateFocusMutateAsync = jest.fn();
const mockUpsertCheckinMutateAsync = jest.fn();
const mockDeleteCheckinMutateAsync = jest.fn();

let mockDomains: FocusDomain[] = [];
let mockHabits: RecurringFocus[] = [];

jest.mock('@/hooks/useFocus', () => ({
  useFocusDomains: () => ({ data: mockDomains }),
  useCreateFocus: () => ({
    mutateAsync: mockCreateFocusMutateAsync,
    isPending: false,
  }),
  useUpsertFocusCheckin: () => ({
    mutateAsync: mockUpsertCheckinMutateAsync,
    isPending: false,
  }),
  useDeleteFocusCheckin: () => ({
    mutateAsync: mockDeleteCheckinMutateAsync,
    isPending: false,
  }),
  useTodayFocusSnapshot: () => ({
    data: {
      daily_recurring: mockHabits,
    },
    isLoading: false,
  }),
}));

describe('HabitCard', () => {
  beforeEach(() => {
    mockCreateFocusMutateAsync.mockReset();
    mockUpsertCheckinMutateAsync.mockReset();
    mockDeleteCheckinMutateAsync.mockReset();

    mockDomains = [
      {
        id: 'dom-1',
        user_id: 'u1',
        name: 'Health & Vitality',
        color: '#10b981',
        icon: null,
        sort_order: 0,
        created_at: '',
        updated_at: '',
      },
    ];

    mockHabits = [
      {
        id: 'h1',
        user_id: 'u1',
        domain_id: 'dom-1',
        timeframe: 'daily',
        statement: 'Morning 20-min Walk',
        target_type: 'none',
        target_value: null,
        unit: null,
        parent_focus_id: null,
        period_date: null,
        due_time: null,
        status: 'active',
        recurrence_days_of_week: [1, 2, 3, 4, 5],
        recurrence_end_date: null,
        created_at: '',
        updated_at: '',
        today_checkin: null,
        done: false,
        current_streak: 5,
      },
      {
        id: 'h2',
        user_id: 'u1',
        domain_id: null,
        timeframe: 'daily',
        statement: 'Drink Water',
        target_type: 'numeric',
        target_value: 8,
        unit: 'glasses',
        parent_focus_id: null,
        period_date: null,
        due_time: null,
        status: 'active',
        recurrence_days_of_week: null,
        recurrence_end_date: null,
        created_at: '',
        updated_at: '',
        today_checkin: {
          id: 'c2',
          user_id: 'u1',
          focus_id: 'h2',
          checkin_date: '2026-09-17',
          progress_value: 4,
          completed: false,
          reflection_note: null,
          created_at: '',
          updated_at: '',
        },
        done: false,
        current_streak: 2,
      },
    ];
  });

  it('renders habits with domain names, streaks, and numeric values', () => {
    render(<HabitCard selectedDate="2026-09-17" />);

    expect(screen.getByText('Morning 20-min Walk')).toBeInTheDocument();
    expect(
      screen.getAllByText('Health & Vitality').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('5 days')).toBeInTheDocument();

    expect(screen.getByText('Drink Water')).toBeInTheDocument();
    expect(screen.getByText('4 / 8 glasses')).toBeInTheDocument();
  });

  it('toggles a habit from incomplete to complete', async () => {
    mockUpsertCheckinMutateAsync.mockResolvedValueOnce({});
    render(<HabitCard selectedDate="2026-09-17" />);

    const markButtons = screen.getAllByRole('button', {
      name: 'Mark as complete',
    });
    fireEvent.click(markButtons[0]!);

    await waitFor(() => {
      expect(mockUpsertCheckinMutateAsync).toHaveBeenCalledWith({
        focusId: 'h1',
        date: '2026-09-17',
        body: { completed: true },
      });
    });
  });

  it('increments a numeric habit by quick step', async () => {
    mockUpsertCheckinMutateAsync.mockResolvedValueOnce({});
    render(<HabitCard selectedDate="2026-09-17" />);

    const incBtn = screen.getByRole('button', {
      name: 'Increment progress',
    });
    fireEvent.click(incBtn);

    await waitFor(() => {
      expect(mockUpsertCheckinMutateAsync).toHaveBeenCalledWith({
        focusId: 'h2',
        date: '2026-09-17',
        body: { progress_value: 5 },
      });
    });
  });

  it('opens Add Habit dialog and disables Save when 0 weekdays are selected', async () => {
    render(<HabitCard selectedDate="2026-09-17" />);

    // Open Add dialog via header Add Habit button
    const openAddBtn = screen.getByRole('button', { name: 'Add Habit' });
    fireEvent.click(openAddBtn);

    const statementInput = screen.getByLabelText(/Habit Statement/i);
    fireEvent.change(statementInput, { target: { value: 'New Test Habit' } });

    const saveButton = screen.getByRole('button', { name: 'Save Habit' });
    expect(saveButton).not.toBeDisabled();

    // Unselect all 7 weekday pills
    const dayPills = screen.getAllByRole('button', {
      name: /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/,
    });
    for (const pill of dayPills) {
      fireEvent.click(pill);
    }

    // Now 0 days are selected -> warning shown & Save disabled
    expect(screen.getByText('Select at least 1 day')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });
});
