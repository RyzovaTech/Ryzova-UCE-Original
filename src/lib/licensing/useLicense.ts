import { useCallback, useEffect, useState } from 'react';
import type { FeatureKey, LicenseState } from './types';
import {
  activateLicense,
  clearLicenseState,
  deactivateLicense,
  FREE_SCAN_LIMIT,
  incrementScanCount,
  loadLicenseState,
} from './store';
import { licenseManager } from './licenseManager';
import { canScan, canUseFeature, isFounder, isProPlan, type ScanAccess } from './featureGate';

export function useLicense() {
  const [state, setState] = useState<LicenseState>(loadLicenseState);

  useEffect(() => {
    setState(loadLicenseState());
  }, []);

  const refresh = useCallback(() => {
    setState(loadLicenseState());
  }, []);

  const recordScan = useCallback(() => {
    const next = incrementScanCount();
    setState(next);
    return next;
  }, []);

  const activate = useCallback(async (key: string) => {
    const result = await licenseManager.activate(key);
    if (result.success) {
      const next = activateLicense(result.plan, result.licenseKey, result.founderTier ?? null);
      setState(next);
    }
    return result;
  }, []);

  const deactivate = useCallback(async () => {
    if (state.licenseKey) {
      await licenseManager.deactivate(state.licenseKey);
    }
    const next = deactivateLicense();
    setState(next);
  }, [state.licenseKey]);

  const reset = useCallback(() => {
    clearLicenseState();
    setState(loadLicenseState());
  }, []);

  const scanAccess: ScanAccess = canScan(state);

  return {
    state,
    plan: state.plan,
    isPro: isProPlan(state.plan),
    isFounder: isFounder(state),
    scanAccess,
    freeScanLimit: FREE_SCAN_LIMIT,
    refresh,
    recordScan,
    activate,
    deactivate,
    reset,
    canUse: (feature: FeatureKey) => canUseFeature(state, feature),
  };
}
