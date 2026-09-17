import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FocusBanner from '@/pages/Home/FocusBanner';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockSnapshotWeekly: { statement: string; domain_id: string | null }[] = [];
const mockDomains = [
  {
    id: 'd1',
    name: 'Health',
    color: '#10b981',
    user_id: 'u1',
    icon: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'd2',
    name: 'Mindset',
    color: '#6366f1',
    user_id: 'u1',
    icon: null,
    sort_order: 1,
    created_at: '',
    updated_at: '',
  },
];

jest.mock('@/hooks/useFocus', () => ({
  useTodayFocusSnapshot: () => ({
    data: {
      weekly: mockSnapshotWeekly,
    },
  }),
  useFocusDomains: () => ({
    data: mockDomains,
  }),
}));

describe('FocusBanner', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSnapshotWeekly = [];
  });

  it('renders invitation state when no weekly focus is active', () => {
    render(<FocusBanner selectedDate="2026-09-17" />);

    expect(screen.getByText('Weekly Focus & Goals')).toBeInTheDocument();
    expect(
      screen.getByText('No weekly focus set for this week')
    ).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Mindset')).toBeInTheDocument();
  });

  it('renders weekly focus statement and pillar when set', () => {
    mockSnapshotWeekly = [
      {
        statement: 'Complete 4 hypertrophy sessions and sleep 8 hours',
        domain_id: 'd1',
      },
    ];

    render(<FocusBanner selectedDate="2026-09-17" />);

    expect(
      screen.getByText('Complete 4 hypertrophy sessions and sleep 8 hours')
    ).toBeInTheDocument();
    expect(screen.getByText('This week’s anchor')).toBeInTheDocument();
  });
});
