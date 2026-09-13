import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Checks if running inside native Android or iOS Capacitor container
 */
export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Returns current platform name ('ios' | 'android' | 'web')
 */
export function getMobilePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

/**
 * Trigger subtle tap haptic feedback (works in native Capacitor and browsers with navigator.vibrate)
 */
export async function triggerLightHaptic(): Promise<void> {
  try {
    if (isNativeMobile()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // Ignore if not supported
  }
}

/**
 * Trigger medium haptic feedback for significant user actions (e.g. status changes, submissions)
 */
export async function triggerMediumHaptic(): Promise<void> {
  try {
    if (isNativeMobile()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(25);
    }
  } catch {
    // Ignore if not supported
  }
}

/**
 * Trigger success haptic feedback (e.g. QC passed, RFC completed, checkout logged)
 */
export async function triggerSuccessHaptic(): Promise<void> {
  try {
    if (isNativeMobile()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 50, 20]);
    }
  } catch {
    // Ignore if not supported
  }
}

/**
 * Trigger warning/error haptic feedback
 */
export async function triggerWarningHaptic(): Promise<void> {
  try {
    if (isNativeMobile()) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 40, 30]);
    }
  } catch {
    // Ignore if not supported
  }
}

/**
 * Request camera and microphone permissions cleanly by invoking a brief getUserMedia stream
 * and immediately stopping all tracks. This prompts the Android OS permission dialog.
 */
export async function requestCameraAndMicPermissions(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('navigator.mediaDevices.getUserMedia is not supported on this platform');
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.warn('Camera/Mic permission denied or unavailable:', err);
    return false;
  }
}

/**
 * Initialize native status bar styling on mobile devices and request camera/mic permissions
 */
export async function initMobileEnvironment(): Promise<void> {
  if (isNativeMobile()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      if (getMobilePlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#020617' });
      }
    } catch (e) {
      console.warn('Status bar initialization bypassed:', e);
    }
  }

  // Pre-request permissions on first install/launch so permissions are active
  const hasPrompted = localStorage.getItem('fixocar_permissions_prompted');
  if (!hasPrompted) {
    // Run after a slight delay to allow the UI to load smoothly
    setTimeout(async () => {
      const granted = await requestCameraAndMicPermissions();
      if (granted) {
        localStorage.setItem('fixocar_permissions_prompted', 'true');
      }
    }, 1500);
  }
}
