import type { FeatureKey, LicenseState, Plan } from './types';
import { FREE_SCAN_LIMIT } from './store';

export interface ScanAccess {
  allowed: boolean;
  remaining: number;
  limit: number;
}

const PRO_FEATURES: FeatureKey[] = [
  'pdfExport',
  'unlimitedScans',
  'commercialLicense',
  'priorityUpdates',
  'earlyAccess',
  'prioritySupport',
];

export function isProPlan(plan: Plan): boolean {
  return plan === 'pro' || plan === 'founder';
}

export function canUseFeature(state: LicenseState, feature: FeatureKey): boolean {
  if (state.plan === 'founder') return true;
  if (state.plan === 'pro') return PRO_FEATURES.includes(feature) || feature === 'scan';
  // free
  if (feature === 'scan') return state.scanCount < FREE_SCAN_LIMIT;
  return false;
}

export function canScan(state: LicenseState): ScanAccess {
  if (isProPlan(state.plan)) {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }
  const remaining = Math.max(0, FREE_SCAN_LIMIT - state.scanCount);
  return { allowed: remaining > 0, remaining, limit: FREE_SCAN_LIMIT };
}

export function isFounder(state: LicenseState): boolean {
  return state.plan === 'founder';
}
