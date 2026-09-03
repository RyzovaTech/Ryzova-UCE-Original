import { useMemo } from 'react';

/**
 * Free/open-source access model.
 *
 * Kept temporarily as a compatibility shim for pages that still import the
 * old hook. There are no plans, payments, license keys, or feature gates.
 */
export function useLicense() {
  return useMemo(() => ({
    isPro: true,
    freeScanLimit: Number.POSITIVE_INFINITY,
    scanAccess: {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
    },
    canUse: (_feature: string) => true,
  }), []);
}
