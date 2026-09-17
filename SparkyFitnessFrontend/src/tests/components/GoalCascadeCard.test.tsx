import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GoalCascadeCard from '@/pages/Focus/GoalCascadeCard';
import type { Focus, FocusDomain } from '@/types/focus';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockDomain: FocusDomain = {
  id: 'dom-1',
  user_id: 'u-1',
  name: 'Strength & Vitality',
  color: '#6366f1',
  icon: null,
  sort_order: 0,
  created_at: '',
  updated_at: '',
};

const mockLongTerm: Focus = {
  id: 'lt-1',
  user_id: 'u-1',
  domain_id: 'dom-1',
  timeframe: 'long_term',
  statement: 'Build a durable, powerful physique (Why: Longevity)',
  target_type: 'none',
  target_value: null,
  unit: null,
  parent_focus_id: null,
  period_date: null,
  due_time: null,
  recurrence_days_of_week: null,
  recurrence_end_date: null,
  status: 'active',
  created_at: '',
  updated_at: '',
};

const mockWeekly: Focus = {
  id: 'wk-1',
  user_id: 'u-1',
  domain_id: 'dom-1',
  timeframe: 'weekly',
  statement: 'Complete 4 heavy lifting workouts',
  target_type: 'numeric',
  target_value: 4,
  unit: 'workouts',
  parent_focus_id: null,
  period_date: '2026-09-15',
  due_time: null,
  recurrence_days_of_week: null,
  recurrence_end_date: null,
  status: 'active',
  created_at: '',
  updated_at: '',
};

const mockDailyList: Focus[] = [
  {
    id: 'dl-1',
    user_id: 'u-1',
    domain_id: 'dom-1',
    timeframe: 'daily',
    statement:
      'Train at 7am [Cue: Clothes laid out | If-Then: If tired, do 20m minimum]',
    target_type: 'boolean',
    target_value: null,
    unit: null,
    parent_focus_id: null,
    period_date: null,
    due_time: null,
    recurrence_days_of_week: [1, 3, 5],
    recurrence_end_date: null,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
];

describe('GoalCascadeCard', () => {
  it('renders domain, North Star, Weekly Focus, and Daily WOOP habit cleanly', () => {
    render(
      <GoalCascadeCard
        domain={mockDomain}
        longTerm={mockLongTerm}
        weekly={mockWeekly}
        dailyList={mockDailyList}
        onCheckIn={jest.fn()}
        onComplete={jest.fn()}
        onDelete={jest.fn()}
        onOpenHistory={jest.fn()}
      />
    );

    expect(screen.getByText('Strength & Vitality')).toBeInTheDocument();
    expect(
      screen.getByText('Build a durable, powerful physique (Why: Longevity)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Complete 4 heavy lifting workouts')
    ).toBeInTheDocument();
    expect(screen.getByText('Train at 7am')).toBeInTheDocument();

    // Verify WOOP parsing
    expect(screen.getByText('Clothes laid out')).toBeInTheDocument();
    expect(screen.getByText('If tired, do 20m minimum')).toBeInTheDocument();
  });

  it('triggers onCheckIn when check-in button is clicked on a focus item', () => {
    const handleCheckIn = jest.fn();
    render(
      <GoalCascadeCard
        domain={mockDomain}
        longTerm={mockLongTerm}
        weekly={mockWeekly}
        dailyList={mockDailyList}
        onCheckIn={handleCheckIn}
        onComplete={jest.fn()}
        onDelete={jest.fn()}
        onOpenHistory={jest.fn()}
      />
    );

    const checkInButtons = screen.getAllByTitle('Check In');
    expect(checkInButtons[0]).toBeDefined();
    fireEvent.click(checkInButtons[0]!);
    expect(handleCheckIn).toHaveBeenCalledWith(mockWeekly);
  });
});
