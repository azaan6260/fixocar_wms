import { ToastType } from '../types/toast';

const SOUND_MUTE_STORAGE_KEY = 'fixocar_sound_muted';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

/**
 * Configure the browser's AudioSession to 'ambient' mode.
 * On mobile operating systems (iOS & Android browsers supporting AudioSession API),
 * 'ambient' audio is strictly muted whenever the phone hardware ringer is on Silent or Vibrate mode.
 */
function configureAmbientSilentModeRespect() {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).audioSession) {
      (navigator as any).audioSession.type = 'ambient';
    }
  } catch {
    // Ignore if AudioSession API is not supported on this browser
  }
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  configureAmbientSilentModeRespect();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

// Unlock AudioContext on first user gesture so background sync notifications can play chimes
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (audioUnlocked) return;
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      audioUnlocked = true;
    } catch {
      // ignore
    }
  };
  window.addEventListener('touchstart', unlock, { passive: true, once: true });
  window.addEventListener('click', unlock, { passive: true, once: true });
  window.addEventListener('keydown', unlock, { passive: true, once: true });
}

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('fixocar_sound_pref_changed', { detail: { muted } }));
  } catch {
    // ignore
  }
}

/**
 * Checks if the device or app is currently in silent mode.
 */
export function isDeviceOrAppSilent(): boolean {
  if (typeof window === 'undefined') return true;
  if (isSoundMuted()) return true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;

  // Check native Android/Capacitor bridge if exposed
  const androidBridge = (window as any).AndroidBridge || (window as any).Capacitor?.Plugins?.DeviceAudio;
  if (androidBridge && typeof androidBridge.isSilentMode === 'function') {
    try {
      if (androidBridge.isSilentMode()) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

function playToneSequence(
  ctx: AudioContext,
  notes: { freq: number; startOffset: number; duration: number; gain?: number; type?: OscillatorType }[]
) {
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.setValueAtTime(n.freq, now + n.startOffset);

    const peakGain = n.gain ?? 0.16;
    gainNode.gain.setValueAtTime(0.001, now + n.startOffset);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + n.startOffset + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.startOffset + n.duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now + n.startOffset);
    osc.stop(now + n.startOffset + n.duration + 0.01);
  }
}

/**
 * Plays distinct notification chimes for:
 * - VEHICLE_CHECK_IN: 3-note rising arrival chime (Gate Check-In)
 * - TASK_ALLOTTED / ADDITIONAL_WORK_APPROVED: 2-pulse mechanic task allotment & proceed alert
 * - ADDITIONAL_WORK_REQUESTED: Floor manager attention chime
 * Automatically respects phone Silent Mode (via ambient AudioSession & silent check).
 */
export function playNotificationChime(type: ToastType = 'INFO') {
  try {
    if (isDeviceOrAppSilent()) return;

    configureAmbientSilentModeRespect();
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (type === 'VEHICLE_CHECK_IN' || type === 'JOB_CARD_CREATED') {
      // Crisp 3-note rising arrival chime: C5 -> E5 -> G5 -> C6
      playToneSequence(ctx, [
        { freq: 523.25, startOffset: 0.0, duration: 0.12, gain: 0.18, type: 'triangle' },
        { freq: 659.25, startOffset: 0.11, duration: 0.12, gain: 0.18, type: 'triangle' },
        { freq: 783.99, startOffset: 0.22, duration: 0.14, gain: 0.20, type: 'triangle' },
        { freq: 1046.5, startOffset: 0.35, duration: 0.28, gain: 0.22, type: 'sine' },
      ]);
    } else if (type === 'TASK_ALLOTTED' || type === 'ADDITIONAL_WORK_APPROVED') {
      // Energetic 2-pulse Mechanic Allotment & Proceed chime: (A5 -> C#6 -> E6) x2
      playToneSequence(ctx, [
        { freq: 880.0, startOffset: 0.0, duration: 0.1, gain: 0.22, type: 'triangle' },
        { freq: 1108.73, startOffset: 0.09, duration: 0.1, gain: 0.22, type: 'triangle' },
        { freq: 1318.51, startOffset: 0.18, duration: 0.18, gain: 0.25, type: 'sine' },
        // Second pulse
        { freq: 880.0, startOffset: 0.42, duration: 0.1, gain: 0.22, type: 'triangle' },
        { freq: 1108.73, startOffset: 0.51, duration: 0.1, gain: 0.22, type: 'triangle' },
        { freq: 1318.51, startOffset: 0.60, duration: 0.25, gain: 0.26, type: 'sine' },
      ]);
    } else if (type === 'ADDITIONAL_WORK_REQUESTED') {
      // Manager attention chime: F5 -> A5 -> D6
      playToneSequence(ctx, [
        { freq: 698.46, startOffset: 0.0, duration: 0.14, gain: 0.2, type: 'triangle' },
        { freq: 880.0, startOffset: 0.13, duration: 0.14, gain: 0.2, type: 'triangle' },
        { freq: 1174.66, startOffset: 0.26, duration: 0.3, gain: 0.24, type: 'sine' },
      ]);
    } else if (type === 'ESTIMATE_APPROVED' || type === 'SUCCESS') {
      // High double chime (E5 -> G5)
      playToneSequence(ctx, [
        { freq: 659.25, startOffset: 0.0, duration: 0.12, gain: 0.15 },
        { freq: 783.99, startOffset: 0.11, duration: 0.25, gain: 0.18 },
      ]);
    } else if (type === 'ESTIMATE_DECLINED' || type === 'WARNING') {
      // Lower double chime (E4 -> C4)
      playToneSequence(ctx, [
        { freq: 329.63, startOffset: 0.0, duration: 0.14, gain: 0.15 },
        { freq: 261.63, startOffset: 0.13, duration: 0.25, gain: 0.15 },
      ]);
    } else {
      // Soft single chime (C5 -> E5)
      playToneSequence(ctx, [
        { freq: 523.25, startOffset: 0.0, duration: 0.1, gain: 0.12 },
        { freq: 659.25, startOffset: 0.09, duration: 0.22, gain: 0.14 },
      ]);
    }
  } catch {
    // Graceful fallback if audio context blocked or unsupported
  }
}

