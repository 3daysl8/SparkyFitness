import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DailyHealthMetrics } from '@workspace/shared';
import WearableHealthCard from '@/pages/Home/WearableHealthCard';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'user-1' }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    distanceUnit: 'km',
    convertDistance: (value: number) => value,
  }),
}));

const mockUseDailyHealthMetrics = jest.fn();
jest.mock('@/hooks/useGenericHealth', () => ({
  useDailyHealthMetrics: (...args: unknown[]) =>
    mockUseDailyHealthMetrics(...args),
}));

const DATE = '2026-09-18';

function metrics(
  overrides: Partial<DailyHealthMetrics> = {}
): DailyHealthMetrics {
  return {
    id: 'm-1',
    user_id: 'user-1',
    entry_date: DATE,
    source_provider: 'garmin',
    device_name: null,
    total_steps: 8133,
    step_goal: null,
    total_distance_meters: 6597,
    floors_ascended: 7,
    floors_descended: 5,
    active_calories: null,
    bmr_calories: null,
    total_calories: null,
    total_calories_captured_at: null,
    highly_active_seconds: null,
    active_seconds: null,
    sedentary_seconds: null,
    moderate_intensity_minutes: null,
    vigorous_intensity_minutes: null,
    exercise_minutes: null,
    stand_hours: null,
    resting_heart_rate: 58,
    heart_rate_recovery_1min: null,
    vo2_max: 47,
    fitness_age: null,
    lactate_threshold_bpm: null,
    lactate_threshold_speed_mps: null,
    walking_asymmetry_percentage: null,
    hill_score: null,
    race_prediction_5k_seconds: null,
    race_prediction_10k_seconds: null,
    race_prediction_half_marathon_seconds: null,
    race_prediction_marathon_seconds: null,
    recovery_time_hours: null,
    training_readiness_score: 72,
    endurance_score: null,
    weekly_training_load: null,
    acute_training_load: null,
    chronic_training_load: null,
    acwr_ratio: null,
    avg_stress_level: 24,
    max_stress_level: 61,
    body_battery_charged: 80,
    body_battery_drained: 65,
    body_battery_highest: 92,
    body_battery_lowest: 18,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe('WearableHealthCard', () => {
  beforeEach(() => {
    mockUseDailyHealthMetrics.mockReset();
  });

  it('renders nothing when no wearable data exists for the date', () => {
    mockUseDailyHealthMetrics.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<WearableHealthCard selectedDate={DATE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the query has not resolved data yet', () => {
    mockUseDailyHealthMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    const { container } = render(<WearableHealthCard selectedDate={DATE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows today's steps, distance, floors, and wellness tiles with the source badge", () => {
    mockUseDailyHealthMetrics.mockReturnValue({
      data: [metrics()],
      isLoading: false,
    });
    render(<WearableHealthCard selectedDate={DATE} />);

    expect(
      screen.getByText('Daily Wearable Health Summary')
    ).toBeInTheDocument();
    expect(screen.getByText('garmin')).toBeInTheDocument();

    // Steps rendered with thousands separator.
    expect(screen.getByText('8,133')).toBeInTheDocument();
    // Distance converted (identity mock) from meters to km, 2dp + unit.
    expect(screen.getByText('6.60 km')).toBeInTheDocument();
    // Floors ascended, with descended as a sub-line.
    expect(screen.getByText('7')).toBeInTheDocument();

    // A couple of the pre-existing wellness tiles, unchanged by this pass.
    expect(screen.getByText('92')).toBeInTheDocument(); // body battery highest
    expect(screen.getByText('58')).toBeInTheDocument(); // resting HR
  });

  it('falls back to "--" for steps/distance/floors the provider did not report', () => {
    mockUseDailyHealthMetrics.mockReturnValue({
      data: [
        metrics({
          total_steps: null,
          total_distance_meters: null,
          floors_ascended: null,
          floors_descended: null,
        }),
      ],
      isLoading: false,
    });
    render(<WearableHealthCard selectedDate={DATE} />);

    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
