import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutHistorySessionCard from '@/pages/Exercises/WorkoutHistorySessionCard';
import type { ExerciseSessionResponse } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    weightUnit: 'kg',
    formatDateInUserTimezone: (date: string) => date,
  }),
}));

const individualSession = {
  type: 'individual',
  id: 'entry-1',
  entry_date: '2026-09-10',
  name: 'Morning Run',
  duration_minutes: 30,
  sets: [],
  exercise_snapshot: { name: 'Running' },
} as unknown as ExerciseSessionResponse;

describe('WorkoutHistorySessionCard', () => {
  it('calls onRepeat and onDelete from their respective buttons, not each other', () => {
    const onRepeat = jest.fn();
    const onDelete = jest.fn();

    render(
      <WorkoutHistorySessionCard
        session={individualSession}
        onRepeat={onRepeat}
        onDelete={onDelete}
      />
    );

    // Both actions live in the expanded footer.
    fireEvent.click(screen.getByText('Morning Run'));

    fireEvent.click(screen.getByRole('button', { name: 'Repeat Workout' }));
    expect(onRepeat).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRepeat).toHaveBeenCalledTimes(1);
  });
});
