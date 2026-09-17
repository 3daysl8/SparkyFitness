/**
 * Synthesizes clean audio chimes, countdown beeps, and triggers haptic vibration
 * for rest timer completions and workout milestones using the Web Audio API.
 */

const STORAGE_KEY_AUDIO_ENABLED = 'sparky.restTimerAudio.enabled';
const STORAGE_KEY_BEEPS_ENABLED = 'sparky.restTimerBeeps.enabled';
const STORAGE_KEY_VIBRATION_ENABLED = 'sparky.restTimerVibration.enabled';

/**
 * Check whether rest timer audio feedback is enabled (default: true).
 */
export function isRestTimerAudioEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_AUDIO_ENABLED);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Enable or disable rest timer audio feedback.
 */
export function setRestTimerAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_AUDIO_ENABLED, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check whether countdown beeps (3, 2, 1) are enabled (default: true).
 */
export function isRestTimerBeepsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_BEEPS_ENABLED);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Enable or disable rest timer countdown beeps.
 */
export function setRestTimerBeepsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_BEEPS_ENABLED, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check whether haptic vibration is enabled (default: true).
 */
export function isRestTimerVibrationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(STORAGE_KEY_VIBRATION_ENABLED);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Enable or disable rest timer haptic vibration.
 */
export function setRestTimerVibrationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_VIBRATION_ENABLED, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Plays a short, crisp countdown beep at 3, 2, or 1 seconds remaining.
 * 3s -> 440 Hz (A4)
 * 2s -> 554.37 Hz (C#5)
 * 1s -> 659.25 Hz (E5)
 */
export function playRestTimerCountdownBeep(second: number): void {
  if (!isRestTimerAudioEnabled() || !isRestTimerBeepsEnabled()) {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const freq = second === 1 ? 659.25 : second === 2 ? 554.37 : 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Smooth envelope to prevent audio clipping / clicks
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  } catch (err) {
    console.debug('Rest timer countdown beep prevented:', err);
  }
}

/**
 * Plays a pleasant harmonic fanfare chime (D5 587.33 Hz -> F#5 739.99 Hz -> A5 880 Hz)
 * completely synthesized in-browser with zero external audio assets.
 */
export function playRestTimerChime(): void {
  if (!isRestTimerAudioEnabled()) {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: F#5 (739.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(739.99, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.2, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.48);

    // Tone 3: A5 (880 Hz) - Bright finish
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(880, now + 0.24);
    gain3.gain.setValueAtTime(0.001, now + 0.24);
    gain3.gain.exponentialRampToValueAtTime(0.24, now + 0.26);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.24);
    osc3.stop(now + 0.75);
  } catch (err) {
    console.debug('Rest timer audio chime playback prevented:', err);
  }
}

/**
 * Triggers a haptic pulse pattern on devices that support navigator.vibrate.
 */
export function triggerRestTimerVibration(): void {
  if (!isRestTimerVibrationEnabled()) {
    return;
  }

  try {
    if (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // Silently ignore if vibration is unsupported or disabled
  }
}
