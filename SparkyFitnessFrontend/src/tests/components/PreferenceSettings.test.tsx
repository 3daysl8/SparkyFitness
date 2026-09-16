import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import { PreferenceSettings } from '@/pages/Settings/PreferenceSettings';
import { renderWithClient } from '../test-utils';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockSetWeeklyWorkoutTargetTotal = jest.fn();
const mockSetWeeklyWorkoutTargetStrength = jest.fn();
const mockSetWeeklyWorkoutTargetCardio = jest.fn();
const mockSetWeeklyCardioMinMinutes = jest.fn();
const mockSetWeeklyStrengthCounting = jest.fn();
const mockSaveAllPreferences = jest.fn().mockResolvedValue(undefined);

// PreferenceSettings reads everything through usePreferences() -- this stub
// covers every field the component destructures (not just the ones this
// lane added) so the existing controls in the same grid still render.
const basePreferences = {
  weightUnit: 'kg',
  setWeightUnit: jest.fn(),
  measurementUnit: 'cm',
  setMeasurementUnit: jest.fn(),
  distanceUnit: 'km',
  setDistanceUnit: jest.fn(),
  energyUnit: 'kcal',
  setEnergyUnit: jest.fn(),
  dateFormat: 'MM/dd/yyyy',
  setDateFormat: jest.fn(),
  timeFormat: 'h:mm A',
  setTimeFormat: jest.fn(),
  chartScaleMode: 'time',
  setChartScaleMode: jest.fn(),
  itemDisplayLimit: 10,
  setItemDisplayLimit: jest.fn(),
  autoScaleOpenFoodFactsImports: false,
  setAutoScaleOpenFoodFactsImports: jest.fn(),
  autoScaleOnlineImports: true,
  setAutoScaleOnlineImports: jest.fn(),
  setLanguage: jest.fn(),
  language: 'en',
  loggingLevel: 'ERROR',
  firstDayOfWeek: 0,
  setFirstDayOfWeek: jest.fn(),
  measurementDecimalPlaces: 0,
  setMeasurementDecimalPlaces: jest.fn(),
  timezone: 'UTC',
  setTimezone: jest.fn(),
  standardDrinkGrams: 14,
  setStandardDrinkGrams: jest.fn(),
  weeklyAlcoholLimitG: null,
  setWeeklyAlcoholLimitG: jest.fn(),
  caffeineHalfLifeHours: 5,
  setCaffeineHalfLifeHours: jest.fn(),
  targetBedtime: '22:30',
  setTargetBedtime: jest.fn(),
  saveAllPreferences: mockSaveAllPreferences,
};

let mockPreferences: Record<string, unknown>;

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => mockPreferences,
}));

function renderPreferenceSettings() {
  return renderWithClient(
    <Accordion type="multiple" defaultValue={['user-preferences']}>
      <AccordionItem value="user-preferences">
        <PreferenceSettings />
      </AccordionItem>
    </Accordion>
  );
}

describe('PreferenceSettings weekly workout goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveAllPreferences.mockResolvedValue(undefined);
    mockPreferences = {
      ...basePreferences,
      weeklyWorkoutTargetTotal: 4,
      setWeeklyWorkoutTargetTotal: mockSetWeeklyWorkoutTargetTotal,
      weeklyWorkoutTargetStrength: null,
      setWeeklyWorkoutTargetStrength: mockSetWeeklyWorkoutTargetStrength,
      weeklyWorkoutTargetCardio: 2,
      setWeeklyWorkoutTargetCardio: mockSetWeeklyWorkoutTargetCardio,
      weeklyCardioMinMinutes: 20,
      setWeeklyCardioMinMinutes: mockSetWeeklyCardioMinMinutes,
      weeklyStrengthCounting: 'any_strength',
      setWeeklyStrengthCounting: mockSetWeeklyStrengthCounting,
    };
  });

  it('renders the five weekly goal controls seeded from preferences, including empty for an unset target', () => {
    renderPreferenceSettings();

    expect(
      screen.getByLabelText('Weekly Workout Target (Sessions)')
    ).toHaveValue(4);
    // Strength has no target set -- the input must be empty, not "0" or "null".
    expect(
      screen.getByLabelText('Weekly Strength Target (Sessions)')
    ).toHaveValue(null);
    expect(
      screen.getByLabelText('Weekly Cardio Target (Sessions)')
    ).toHaveValue(2);
    expect(
      screen.getByLabelText('Cardio Minimum Session Length (Minutes)')
    ).toHaveValue(20);
    expect(
      screen.getByText('Count any strength-looking session')
    ).toBeInTheDocument();
  });

  it('clearing a target input sets it back to null rather than 0', () => {
    renderPreferenceSettings();

    const input = screen.getByLabelText('Weekly Workout Target (Sessions)');
    fireEvent.change(input, { target: { value: '' } });

    expect(mockSetWeeklyWorkoutTargetTotal).toHaveBeenCalledWith(null);
  });

  it('rejects a non-positive target the same way the alcohol limit rejects it', () => {
    renderPreferenceSettings();

    const input = screen.getByLabelText('Weekly Cardio Target (Sessions)');
    fireEvent.change(input, { target: { value: '0' } });

    expect(mockSetWeeklyWorkoutTargetCardio).toHaveBeenCalledWith(null);
  });

  it('parses a typed target into an integer', () => {
    renderPreferenceSettings();

    const input = screen.getByLabelText('Weekly Strength Target (Sessions)');
    fireEvent.change(input, { target: { value: '3' } });

    expect(mockSetWeeklyWorkoutTargetStrength).toHaveBeenCalledWith(3);
  });

  it('clamps a negative cardio minimum minutes entry to at least 1', () => {
    renderPreferenceSettings();

    const input = screen.getByLabelText(
      'Cardio Minimum Session Length (Minutes)'
    );
    fireEvent.change(input, { target: { value: '-5' } });

    expect(mockSetWeeklyCardioMinMinutes).toHaveBeenCalledWith(1);
  });

  // Mirrors the existing caffeineHalfLifeHours/measurementDecimalPlaces
  // inputs in this same file: an unparseable or falsy entry (here "0", since
  // `parseInt('0', 10) || 20` takes the fallback) resets to the field's
  // documented default rather than persisting a nonsense value.
  it('falls back to the 20-minute default when the input cannot be parsed', () => {
    renderPreferenceSettings();

    const input = screen.getByLabelText(
      'Cardio Minimum Session Length (Minutes)'
    );
    fireEvent.change(input, { target: { value: '0' } });

    expect(mockSetWeeklyCardioMinMinutes).toHaveBeenCalledWith(20);
  });

  it('switches the strength counting mode via the select', async () => {
    renderPreferenceSettings();

    fireEvent.click(document.getElementById('weekly_strength_counting')!);
    fireEvent.click(
      await screen.findByRole('option', {
        name: "Only count sessions I've explicitly tagged as strength",
      })
    );

    expect(mockSetWeeklyStrengthCounting).toHaveBeenCalledWith('explicit_only');
  });

  it('bundles all five weekly goal fields into the single Save Preferences call', async () => {
    renderPreferenceSettings();

    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/ }));

    await waitFor(() => expect(mockSaveAllPreferences).toHaveBeenCalled());
    expect(mockSaveAllPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyWorkoutTargetTotal: 4,
        weeklyWorkoutTargetStrength: null,
        weeklyWorkoutTargetCardio: 2,
        weeklyCardioMinMinutes: 20,
        weeklyStrengthCounting: 'any_strength',
      })
    );
  });
});
