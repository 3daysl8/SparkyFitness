import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddWorkoutPlanDialog from '@/pages/Exercises/AddWorkoutPlanDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

// No signed-in user keeps every userId-gated query (useWorkoutPresets, used
// internally by useWorkoutPlanAssignments) disabled, so the dialog renders
// with its real hooks and no network/query-client mocking beyond the
// provider itself — only firstDayOfWeek (read directly by the dialog) needs
// to vary between tests.
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: undefined }),
}));

let mockFirstDayOfWeek = 0;
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    weightUnit: 'kg',
    get firstDayOfWeek() {
      return mockFirstDayOfWeek;
    },
  }),
}));

const renderDialog = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddWorkoutPlanDialog
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn()}
        initialData={null}
      />
    </QueryClientProvider>
  );
};

const dayHeadingOrder = () =>
  screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);

describe('AddWorkoutPlanDialog day-of-week ordering', () => {
  afterEach(() => {
    mockFirstDayOfWeek = 0;
  });

  it('renders Sunday-first when the preference is Sunday (0)', () => {
    mockFirstDayOfWeek = 0;
    renderDialog();

    expect(dayHeadingOrder()).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });

  it('renders Monday-first when the preference is Monday (1), without changing DAYS_OF_WEEK ids', () => {
    mockFirstDayOfWeek = 1;
    renderDialog();

    expect(dayHeadingOrder()).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });
});
