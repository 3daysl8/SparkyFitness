import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExerciseRmLadder from '@/components/ExerciseCharts/ExerciseRmLadder';
import type { ExerciseProgressResponse } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue,
  }),
}));

describe('ExerciseRmLadder', () => {
  it('renders empty state when no entries are provided', () => {
    render(<ExerciseRmLadder progressEntries={[]} weightUnit="kg" />);
    expect(
      screen.getByText('No personal records logged yet.')
    ).toBeInTheDocument();
  });

  it('computes RM records and volume highlights from progression entries', () => {
    const mockEntries: ExerciseProgressResponse[] = [
      {
        exercise_entry_id: 'e1',
        entry_date: '2026-01-10',
        duration_minutes: 30,
        calories_burned: 150,
        notes: null,
        image_url: null,
        distance: null,
        avg_heart_rate: null,
        provider_name: 'manual',
        sets: [
          {
            set_number: 1,
            set_type: 'Working Set',
            weight: 100,
            reps: 1,
            duration: null,
            distance: null,
          },
        ],
      },
      {
        exercise_entry_id: 'e2',
        entry_date: '2026-02-15',
        duration_minutes: 30,
        calories_burned: 150,
        notes: null,
        image_url: null,
        distance: null,
        avg_heart_rate: null,
        provider_name: 'manual',
        sets: [
          {
            set_number: 1,
            set_type: 'Working Set',
            weight: 85,
            reps: 5,
            duration: null,
            distance: null,
          },
        ],
      },
      {
        exercise_entry_id: 'e3',
        entry_date: '2026-03-20',
        duration_minutes: 30,
        calories_burned: 150,
        notes: null,
        image_url: null,
        distance: null,
        avg_heart_rate: null,
        provider_name: 'manual',
        sets: [
          {
            set_number: 1,
            set_type: 'Working Set',
            weight: 70,
            reps: 10,
            duration: null,
            distance: null,
          },
        ],
      },
    ];

    render(<ExerciseRmLadder progressEntries={mockEntries} weightUnit="kg" />);

    expect(screen.getByText('Heaviest Lift')).toBeInTheDocument();
    expect(screen.getByText('Max Set Volume')).toBeInTheDocument();
    expect(screen.getByText('Rep Max (RM) Records')).toBeInTheDocument();

    // 1RM record
    expect(screen.getByText('1RM')).toBeInTheDocument();
    // 5RM record
    expect(screen.getByText('5RM')).toBeInTheDocument();
    // 10RM record
    expect(screen.getByText('10RM')).toBeInTheDocument();
  });
});
