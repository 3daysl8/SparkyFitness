import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WeekdayToggle from '@/pages/Focus/WeekdayToggle';

let mockFirstDayOfWeek = 0;
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ firstDayOfWeek: mockFirstDayOfWeek }),
}));

describe('WeekdayToggle', () => {
  beforeEach(() => {
    mockFirstDayOfWeek = 0;
  });

  it('renders Sunday-first by default', () => {
    render(<WeekdayToggle selected={new Set()} onChange={jest.fn()} />);

    const labels = screen.getAllByRole('button').map((btn) => btn.textContent);
    expect(labels).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('reorders the visible buttons for a Monday-first preference, without changing which id each label represents', () => {
    mockFirstDayOfWeek = 1;
    render(<WeekdayToggle selected={new Set()} onChange={jest.fn()} />);

    const labels = screen.getAllByRole('button').map((btn) => btn.textContent);
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('still toggles the correct day id (0 = Sunday) regardless of visual position', () => {
    mockFirstDayOfWeek = 1;
    const handleChange = jest.fn();
    render(
      <WeekdayToggle selected={new Set([1, 2])} onChange={handleChange} />
    );

    // "Sun" now renders last (position 6) under a Monday-first layout, but
    // clicking it must still toggle id 0, not its visual index.
    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    expect(handleChange).toHaveBeenCalledWith(new Set([1, 2, 0]));
  });

  it('marks a selected day id as the "default" variant regardless of where it renders', () => {
    mockFirstDayOfWeek = 1;
    render(<WeekdayToggle selected={new Set([0])} onChange={jest.fn()} />);

    // Only "Sun" (id 0) is selected; it now renders last under Monday-first.
    const sunButton = screen.getByRole('button', { name: 'Sun' });
    const monButton = screen.getByRole('button', { name: 'Mon' });
    expect(sunButton.className).not.toBe(monButton.className);
  });
});
