import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgramsActionBar from '@/pages/Exercises/ProgramsActionBar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
}));

describe('ProgramsActionBar', () => {
  it('renders all three actions and calls the matching handler for each', () => {
    const onAddSchedule = jest.fn();
    const onCreateProgram = jest.fn();
    const onPlanWorkout = jest.fn();

    render(
      <ProgramsActionBar
        onAddSchedule={onAddSchedule}
        onCreateProgram={onCreateProgram}
        onPlanWorkout={onPlanWorkout}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Create Program \/ Split/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /New Routine/i }));
    fireEvent.click(screen.getByRole('button', { name: /Plan a Workout/i }));

    expect(onAddSchedule).toHaveBeenCalledTimes(1);
    expect(onCreateProgram).toHaveBeenCalledTimes(1);
    expect(onPlanWorkout).toHaveBeenCalledTimes(1);
  });
});
