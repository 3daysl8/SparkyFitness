import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserAccountMenu from '@/components/UserAccountMenu';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const mockSignOut = jest.fn();
const mockSwitchToUser = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'u-1',
      fullName: 'Alex Morgan',
      email: 'alex@example.com',
      role: 'user',
    },
    signOut: mockSignOut,
  }),
}));

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({
    activeUserId: 'u-1',
    activeUserName: 'Alex Morgan',
    isActingOnBehalf: false,
    accessibleUsers: [
      {
        user_id: 'u-2',
        full_name: 'Jordan Morgan',
        email: 'jordan@example.com',
        permissions: { checkin: true, diary: true },
      },
    ],
    switchToUser: mockSwitchToUser,
  }),
}));

const openMenu = (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, {
    pointerId: 1,
    defaultPrevented: false,
    button: 0,
  });
  fireEvent.click(trigger);
};

describe('UserAccountMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user avatar and name in trigger', () => {
    render(<UserAccountMenu />);
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument();
  });

  it('opens dropdown menu with profile, security, and sign out options', async () => {
    render(<UserAccountMenu />);
    const trigger = screen.getByRole('button', { name: /user account menu/i });
    openMenu(trigger);

    await waitFor(() => {
      expect(screen.getByText('alex@example.com')).toBeInTheDocument();
      expect(screen.getByText('Profile & Info')).toBeInTheDocument();
      expect(screen.getByText('Login & Passkeys')).toBeInTheDocument();
      expect(screen.getByText('Wellness & Tracking')).toBeInTheDocument();
      expect(screen.getByText('Developer & Integrations')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  it('navigates to profile information when clicked', async () => {
    render(<UserAccountMenu />);
    const trigger = screen.getByRole('button', { name: /user account menu/i });
    openMenu(trigger);

    await waitFor(() => {
      expect(screen.getByText('Profile & Info')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Profile & Info'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/settings?tab=profile-account&section=profile-information'
    );
  });

  it('navigates to account security when clicked', async () => {
    render(<UserAccountMenu />);
    const trigger = screen.getByRole('button', { name: /user account menu/i });
    openMenu(trigger);

    await waitFor(() => {
      expect(screen.getByText('Login & Passkeys')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Login & Passkeys'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/settings?tab=profile-account&section=account-security'
    );
  });

  it('calls signOut and redirects on sign out click', async () => {
    render(<UserAccountMenu />);
    const trigger = screen.getByRole('button', { name: /user account menu/i });
    openMenu(trigger);

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
