/**
 * Notification and reminder management utilities for web and PWA.
 */

export const STORAGE_KEY_SUPPLEMENT_REMINDERS = 'sparky.reminders.supplements';
export const STORAGE_KEY_CHECKIN_REMINDERS = 'sparky.reminders.checkin';
export const STORAGE_KEY_CHECKIN_TIME = 'sparky.reminders.checkinTime';
export const STORAGE_KEY_WORKOUT_REMINDERS = 'sparky.reminders.workouts';
export const STORAGE_KEY_FASTING_REMINDERS = 'sparky.reminders.fasting';

export type WebNotificationPermission =
  'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Gets the current system notification permission status.
 */
export function getNotificationPermission(): WebNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as WebNotificationPermission;
}

/**
 * Requests browser permission for web notifications.
 */
export async function requestNotificationPermission(): Promise<WebNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm as WebNotificationPermission;
  } catch (err) {
    console.debug('Failed to request notification permission:', err);
    return 'denied';
  }
}

/**
 * Displays a local browser notification if permissions are granted.
 */
export function showWebNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission === 'granted') {
    try {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    } catch (err) {
      console.debug('Failed to dispatch notification:', err);
    }
  }
  return null;
}

// --- Local Storage Getters & Setters ---

export function isSupplementReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_SUPPLEMENT_REMINDERS);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSupplementReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SUPPLEMENT_REMINDERS, String(enabled));
  } catch {
    // Storage access might be restricted
  }
}

export function isCheckInReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_CHECKIN_REMINDERS);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setCheckInReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CHECKIN_REMINDERS, String(enabled));
  } catch {
    // Storage access might be restricted
  }
}

export function getCheckInReminderTime(): string {
  if (typeof window === 'undefined') return '20:00';
  try {
    return localStorage.getItem(STORAGE_KEY_CHECKIN_TIME) || '20:00';
  } catch {
    return '20:00';
  }
}

export function setCheckInReminderTime(time: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CHECKIN_TIME, time);
  } catch {
    // Storage access might be restricted
  }
}

export function isWorkoutReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_WORKOUT_REMINDERS);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setWorkoutReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_WORKOUT_REMINDERS, String(enabled));
  } catch {
    // Storage access might be restricted
  }
}

export function isFastingReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_FASTING_REMINDERS);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setFastingReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_FASTING_REMINDERS, String(enabled));
  } catch {
    // Storage access might be restricted
  }
}
