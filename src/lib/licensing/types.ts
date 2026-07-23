export type Plan = 'free' | 'pro' | 'founder';

export type FeatureKey =
  | 'scan'
  | 'pdfExport'
  | 'unlimitedScans'
  | 'commercialLicense'
  | 'priorityUpdates'
  | 'earlyAccess'
  | 'prioritySupport'
  | 'founderStatus';

export interface LicenseState {
  plan: Plan;
  scanCount: number;
  licenseKey: string | null;
  activatedAt: string | null;
  founderTier: number | null;
}

export interface ActivationResult {
  success: boolean;
  plan: Plan;
  licenseKey: string;
  founderTier?: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  plan: Plan;
  founderTier?: number;
  error?: string;
}
