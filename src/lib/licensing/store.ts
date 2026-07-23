import type { LicenseState, Plan } from './types';

const STORAGE_KEY = 'uce:v1:license';

export const FREE_SCAN_LIMIT = 5;

const DEFAULT_STATE: LicenseState = {
  plan: 'free',
  scanCount: 0,
  licenseKey: null,
  activatedAt: null,
  founderTier: null,
};

function safeParse(raw: string | null, fallback: LicenseState): LicenseState {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<LicenseState>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function loadLicenseState(): LicenseState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY), DEFAULT_STATE);
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveLicenseState(state: LicenseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore — may throw in private browsing
  }
}

export function clearLicenseState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function incrementScanCount(): LicenseState {
  const state = loadLicenseState();
  const next: LicenseState = { ...state, scanCount: state.scanCount + 1 };
  saveLicenseState(next);
  return next;
}

export function activateLicense(
  plan: Plan,
  licenseKey: string,
  founderTier: number | null = null,
): LicenseState {
  const next: LicenseState = {
    plan,
    scanCount: loadLicenseState().scanCount,
    licenseKey,
    activatedAt: new Date().toISOString(),
    founderTier,
  };
  saveLicenseState(next);
  return next;
}

export function deactivateLicense(): LicenseState {
  const next: LicenseState = { ...DEFAULT_STATE, scanCount: loadLicenseState().scanCount };
  saveLicenseState(next);
  return next;
}
