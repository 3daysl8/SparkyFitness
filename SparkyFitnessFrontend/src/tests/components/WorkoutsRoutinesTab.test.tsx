import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkoutsRoutinesTab from '@/pages/Exercises/WorkoutsRoutinesTab';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ loggingLevel: 'ERROR' }),
}));

const mockCreateWorkoutPlanTemplate = jest.fn();
jest.mock('@/hooks/Exercises/useWorkoutPlans', () => ({
  useCreateWorkoutPlanTemplateMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockCreateWorkoutPlanTemplate(...args),
  }),
}));

// Every sibling below is owned elsewhere (ActiveProgramWidget/MyProgramsGrid
// by lane 3B, AddWorkoutPlanDialog pre-existing) or is exercised by its own
// dedicated test file (PlannedWorkoutsList, AddPlannedWorkoutDialog,
// ProgramsActionBar) — this test only cares that WorkoutsRoutinesTab renders
// each of them and wires the "plan a workout" open/close state correctly.
jest.mock('@/pages/Exercises/ActiveProgramWidget', () => ({
  __esModule: true,
  default: () => <div>ActiveProgramWidget stub</div>,
}));
jest.mock('@/pages/Exercises/MyProgramsGrid', () => ({
  __esModule: true,
  default: () => <div>MyProgramsGrid stub</div>,
}));
jest.mock('@/pages/Exercises/PlannedWorkoutsList', () => ({
  __esModule: true,
  default: () => <div>PlannedWorkoutsList stub</div>,
}));
jest.mock('@/pages/Exercises/AddWorkoutPlanDialog', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>AddWorkoutPlanDialog open</div> : null,
}));
jest.mock('@/pages/Exercises/AddPlannedWorkoutDialog', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>AddPlannedWorkoutDialog open</div> : null,
}));
jest.mock('@/pages/Exercises/ProgramsActionBar', () => ({
  __esModule: true,
  default: ({
    onAddSchedule,
    onCreateProgram,
    onPlanWorkout,
  }: {
    onAddSchedule: () => void;
    onCreateProgram: () => void;
    onPlanWorkout: () => void;
  }) => (
    <div>
      <button onClick={onAddSchedule}>trigger add schedule</button>
      <button onClick={onCreateProgram}>trigger create program</button>
      <button onClick={onPlanWorkout}>trigger plan workout</button>
    </div>
  ),
}));

describe('WorkoutsRoutinesTab', () => {
  beforeEach(() => {
    mockCreateWorkoutPlanTemplate.mockReset();
  });

  it('renders the Active Program Widget, the planned workouts list, and the programs grid', () => {
    render(<WorkoutsRoutinesTab />);

    expect(screen.getByText('ActiveProgramWidget stub')).toBeInTheDocument();
    expect(screen.getByText('PlannedWorkoutsList stub')).toBeInTheDocument();
    expect(screen.getByText('MyProgramsGrid stub')).toBeInTheDocument();
  });

  it('opens AddPlannedWorkoutDialog only after the action bar requests it', () => {
    render(<WorkoutsRoutinesTab />);

    expect(
      screen.queryByText('AddPlannedWorkoutDialog open')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('trigger plan workout'));

    expect(
      screen.getByText('AddPlannedWorkoutDialog open')
    ).toBeInTheDocument();
    // The training-schedule dialog is a separate piece of state — opening
    // the plan-workout dialog must not also open it.
    expect(
      screen.queryByText('AddWorkoutPlanDialog open')
    ).not.toBeInTheDocument();
  });

  it('keeps the plan-workout dialog independent from the add-schedule dialog', () => {
    render(<WorkoutsRoutinesTab />);

    fireEvent.click(screen.getByText('trigger add schedule'));

    expect(screen.getByText('AddWorkoutPlanDialog open')).toBeInTheDocument();
    expect(
      screen.queryByText('AddPlannedWorkoutDialog open')
    ).not.toBeInTheDocument();
  });
});
