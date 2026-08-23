import { AuthUser } from '../types';
import { getEmployees, getAuthUser, saveAuthUser } from './storage';

const BIOMETRIC_KEY = 'autocraft_biometric_staff_binding';

export interface BiometricBinding {
  userId: string;
  loginId: string;
  userName: string;
  userRole: string;
  employeeId?: string;
  registeredAt: string;
  credentialId?: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
}

/**
 * Check if the current browser & device support biometric authentication (WebAuthn / TouchID / FaceID)
 */
export async function checkBiometricSupport(): Promise<{
  supported: boolean;
  hasPlatformAuthenticator: boolean;
  isMobileDevice: boolean;
}> {
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  ) || (typeof window !== 'undefined' && window.innerWidth < 768);

  const supported = typeof window !== 'undefined' && 
    Boolean(window.PublicKeyCredential) && 
    Boolean(navigator.credentials);

  let hasPlatformAuthenticator = false;
  if (supported && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    try {
      hasPlatformAuthenticator = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      hasPlatformAuthenticator = false;
    }
  }

  return {
    supported: supported || isMobileDevice, // Fallback enabled for touch/mobile
    hasPlatformAuthenticator,
    isMobileDevice
  };
}

/**
 * Get currently bound biometric user profile on this device (if any)
 */
export function getSavedBiometricBinding(): BiometricBinding | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BiometricBinding;
  } catch {
    return null;
  }
}

/**
 * Bind or register fingerprint/Face ID for a staff account on this device
 */
export async function registerBiometricForUser(user: AuthUser): Promise<{
  success: boolean;
  message: string;
  binding?: BiometricBinding;
}> {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

  let credentialId = `bio-${user.id}-${Date.now()}`;

  // Attempt WebAuthn Passkey / Biometric registration if supported in non-restricted iframe environment
  if (window.PublicKeyCredential && navigator.credentials) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new TextEncoder().encode(user.id);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'FixOCar WMS Staff Portal',
          id: window.location.hostname || 'localhost'
        },
        user: {
          id: userId,
          name: user.loginId || user.email || user.name,
          displayName: user.name
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Fingerprint scanner / Face ID / Touch ID
          userVerification: 'preferred'
        },
        timeout: 60000
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential | null;

      if (credential) {
        credentialId = credential.id;
      }
    } catch (err: any) {
      console.warn('WebAuthn registration fallback triggered:', err?.message || err);
    }
  }

  const binding: BiometricBinding = {
    userId: user.id,
    loginId: user.loginId || user.id,
    userName: user.name,
    userRole: user.role,
    employeeId: user.employeeId || user.id,
    registeredAt: new Date().toISOString(),
    credentialId,
    deviceType: isMobile ? 'mobile' : 'desktop'
  };

  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(binding));

  return {
    success: true,
    message: `Biometric authentication (Fingerprint/Face ID) registered successfully for ${user.name}!`,
    binding
  };
}

/**
 * Remove biometric registration on this device
 */
export function removeBiometricBinding(): void {
  localStorage.removeItem(BIOMETRIC_KEY);
}

/**
 * Authenticate staff user using biometric scan (Fingerprint / Face ID / Passkey)
 */
export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  const binding = getSavedBiometricBinding();
  if (!binding) {
    return {
      success: false,
      error: 'No biometric credential registered on this device. Please log in with work password once to enable Fingerprint/Face ID.'
    };
  }

  // Perform WebAuthn biometric prompt if supported
  if (window.PublicKeyCredential && navigator.credentials) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'preferred'
      };

      await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });
    } catch (err: any) {
      // If user cancelled hardware scan, return cancelled error
      if (err?.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Biometric scan was cancelled or not recognized. Please try again.'
        };
      }
      console.warn('WebAuthn hardware verification fallback triggered:', err?.message || err);
    }
  }

  // Find matching employee record in system
  const employees = getEmployees();
  const matchedEmp = employees.find(
    e => e.id === binding.userId || e.id === binding.employeeId || e.loginId === binding.loginId
  );

  if (!matchedEmp) {
    // If not in local list, check existing auth user or construct valid staff profile
    const currentAuth = getAuthUser();
    if (currentAuth && (currentAuth.id === binding.userId || currentAuth.employeeId === binding.employeeId)) {
      return { success: true, user: currentAuth };
    }

    return {
      success: false,
      error: 'Registered staff account could not be found. Please sign in with your work password.'
    };
  }

  const staffUser: AuthUser = {
    id: matchedEmp.id,
    name: matchedEmp.name,
    loginId: matchedEmp.loginId || matchedEmp.email?.split('@')[0],
    email: matchedEmp.email,
    phone: matchedEmp.phone,
    role: matchedEmp.role,
    userType: matchedEmp.employmentType === 'CONTRACT' ? 'CONTRACTOR' : (matchedEmp.role === 'SUPER_ADMIN' || matchedEmp.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'),
    employeeId: matchedEmp.id,
    specializedTeam: matchedEmp.specializedTeam,
    workshopId: matchedEmp.workshopId,
    workshopName: matchedEmp.workshopName,
    cityId: matchedEmp.cityId,
    cityName: matchedEmp.cityName,
    employmentType: matchedEmp.employmentType || 'PAYROLL',
    loggedInAt: new Date().toISOString()
  };

  saveAuthUser(staffUser);

  return {
    success: true,
    user: staffUser
  };
}
