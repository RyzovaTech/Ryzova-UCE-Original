import type { ActivationResult, ValidationResult } from './types';

export const CHECKOUT_URLS = {
  pro: 'https://ryzovatech.lemonsqueezy.com/checkout/buy/f3c61a75-4ab4-43e0-ad4e-a72c193f0144?embed=1',
  founder: 'https://ryzovatech.lemonsqueezy.com/checkout/buy/bd120850-aa01-40cd-a71a-e42cf595e11f?embed=1',
} as const;

export interface LicenseManager {
  activate(key: string): Promise<ActivationResult>;
  validate(key: string): Promise<ValidationResult>;
  deactivate(key: string): Promise<void>;
}

// Stub implementation. Replace with real Lemon Squeezy license-key API calls
// once the storefront is created. Key format used by the stub:
//   LEMON_<anything>     → Pro plan
//   FOUNDER_<1-5>        → Founder plan at the given tier
class StubLicenseManager implements LicenseManager {
  async activate(key: string): Promise<ActivationResult> {
    await new Promise((r) => setTimeout(r, 400));
    const trimmed = key.trim();
    if (!trimmed) {
      return { success: false, plan: 'free', licenseKey: key, error: 'License key is required.' };
    }
    if (trimmed.startsWith('LEMON_')) {
      return { success: true, plan: 'pro', licenseKey: trimmed };
    }
    const founderMatch = trimmed.match(/^FOUNDER_([1-5])$/);
    if (founderMatch) {
      const tier = parseInt(founderMatch[1], 10);
      return { success: true, plan: 'founder', licenseKey: trimmed, founderTier: tier };
    }
    return { success: false, plan: 'free', licenseKey: trimmed, error: 'Invalid license key format.' };
  }

  async validate(key: string): Promise<ValidationResult> {
    await new Promise((r) => setTimeout(r, 200));
    const trimmed = key.trim();
    if (trimmed.startsWith('LEMON_')) {
      return { valid: true, plan: 'pro' };
    }
    const founderMatch = trimmed.match(/^FOUNDER_([1-5])$/);
    if (founderMatch) {
      const tier = parseInt(founderMatch[1], 10);
      return { valid: true, plan: 'founder', founderTier: tier };
    }
    return { valid: false, plan: 'free', error: 'Invalid license key.' };
  }

  async deactivate(_key: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
  }
}

export const licenseManager: LicenseManager = new StubLicenseManager();
