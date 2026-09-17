import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExerciseProgressionChart from '@/components/ExerciseCharts/ExerciseProgressionChart';
import type { ExerciseProgressResponse } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue,
  }),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ExerciseProgressionChart', () => {
  it('renders empty state when no entries provided', () => {
    render(<ExerciseProgressionChart progressEntries={[]} weightUnit="kg" />);
    expect(
      screen.getByText('No progression history recorded yet.')
    ).toBeInTheDocument();
  });

  it('renders 1RM metrics and progression chart with data', () => {
    const mockEntries: ExerciseProgressResponse[] = [
      {
        exercise_entry_id: 'e1',
        entry_date: '2026-01-01',
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
            weight: 80,
            reps: 5,
            duration: null,
            distance: null,
          },
        ],
      },
      {
        exercise_entry_id: 'e2',
        entry_date: '2026-03-01',
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
            weight: 90,
            reps: 5,
            duration: null,
            distance: null,
          },
        ],
      },
    ];

    render(
      <ExerciseProgressionChart progressEntries={mockEntries} weightUnit="kg" />
    );

    expect(screen.getByText('Est. 1RM Progression')).toBeInTheDocument();
    expect(screen.getByText('Current 1RM')).toBeInTheDocument();
    expect(screen.getByText('All-Time Peak')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();

    // Verify time filters exist and can be clicked
    const filter30d = screen.getByRole('button', { name: /30d/i });
    const filterAll = screen.getByRole('button', { name: /all/i });
    expect(filter30d).toBeInTheDocument();
    expect(filterAll).toBeInTheDocument();

    fireEvent.click(filter30d);
    fireEvent.click(filterAll);
  });
});
