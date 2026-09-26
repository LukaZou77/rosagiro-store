export const GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY = "rosagiro:google-consent";
export const GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT = "rosagiro:consent-change";

export type GoogleAnalyticsConsentValue = "granted" | "denied";

type PrivacyNavigator = Navigator & {
  globalPrivacyControl?: boolean;
  msDoNotTrack?: string | null;
};

type PrivacyWindow = Window & {
  doNotTrack?: string | null;
};

export function googleAnalyticsPrivacySignalEnabled() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  try {
    const privacyNavigator = navigator as PrivacyNavigator;
    const privacyWindow = window as PrivacyWindow;
    const doNotTrack = privacyNavigator.doNotTrack || privacyNavigator.msDoNotTrack || privacyWindow.doNotTrack;
    return doNotTrack === "1" || doNotTrack === "yes" || privacyNavigator.globalPrivacyControl === true;
  } catch {
    return true;
  }
}

export function getStoredGoogleAnalyticsConsent(): GoogleAnalyticsConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function getGoogleAnalyticsConsent(): boolean {
  if (googleAnalyticsPrivacySignalEnabled()) return false;
  return getStoredGoogleAnalyticsConsent() === "granted";
}

export function persistGoogleAnalyticsConsent(allowed: boolean): void {
  if (typeof window === "undefined") return;
  const value: GoogleAnalyticsConsentValue = allowed && !googleAnalyticsPrivacySignalEnabled() ? "granted" : "denied";
  try {
    window.localStorage.setItem(GOOGLE_ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    // Consent remains false when storage is unavailable.
  }
  window.dispatchEvent(new Event(GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT));
}
