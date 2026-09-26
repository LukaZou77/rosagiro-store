"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "@/components/AnalyticsConsent.module.css";
import {
  GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT,
  getGoogleAnalyticsConsent,
  getStoredGoogleAnalyticsConsent,
  googleAnalyticsPrivacySignalEnabled,
  persistGoogleAnalyticsConsent
} from "@/lib/google-analytics-consent";

export const OPEN_ANALYTICS_CONSENT_SETTINGS_EVENT = "rosagiro:open-consent-settings";

const excludedPath = /^\/(admin|api|pedido|pagamento-simulado)(\/|$)/;

export function isAnalyticsConsentPublicPath(pathname: string | null) {
  return Boolean(pathname && !excludedPath.test(pathname));
}

type ConsentStatus = "granted" | "denied" | "restricted" | "unset" | "pending";

function subscribeToConsent(callback: () => void) {
  window.addEventListener(GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getConsentStatus(): ConsentStatus {
  if (googleAnalyticsPrivacySignalEnabled()) return "restricted";
  return getStoredGoogleAnalyticsConsent() || "unset";
}

function useConsentStatus() {
  return useSyncExternalStore(subscribeToConsent, getConsentStatus, () => "pending");
}

function ConsentChoices({ onComplete }: { onComplete: () => void }) {
  function choose(allowed: boolean) {
    const wasGranted = getGoogleAnalyticsConsent();
    persistGoogleAnalyticsConsent(allowed);
    onComplete();
    if (!allowed && wasGranted) window.location.reload();
  }

  return (
    <div className={styles.actions}>
      <button className={styles.button} type="button" onClick={() => choose(false)}>
        Recusar medição
      </button>
      <button className={styles.button} type="button" onClick={() => choose(true)}>
        Permitir medição
      </button>
    </div>
  );
}

export function AnalyticsConsent() {
  const pathname = usePathname();
  const status = useConsentStatus();
  const [dismissed, setDismissed] = useState(false);
  const [settingsRequested, setSettingsRequested] = useState(false);

  useEffect(() => {
    function openSettings() {
      if (isAnalyticsConsentPublicPath(pathname) && !googleAnalyticsPrivacySignalEnabled()) setSettingsRequested(true);
    }
    window.addEventListener(OPEN_ANALYTICS_CONSENT_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_ANALYTICS_CONSENT_SETTINGS_EVENT, openSettings);
  }, [pathname]);

  const visible =
    isAnalyticsConsentPublicPath(pathname) &&
    status !== "pending" &&
    status !== "restricted" &&
    (settingsRequested || (status === "unset" && !dismissed));
  if (!visible) return null;

  return (
    <aside aria-label="Preferências de medição" aria-live="polite" className={styles.banner}>
      <strong>Medição opcional</strong>
      <p className={styles.copy}>
        Podemos usar Google Analytics e Google Ads para medir visitas, interações e compras. Eles só carregam com sua permissão. <Link href="/politica-de-privacidade">Saiba mais</Link>.
      </p>
      <ConsentChoices
        onComplete={() => {
          setDismissed(true);
          setSettingsRequested(false);
        }}
      />
    </aside>
  );
}

export function AnalyticsConsentSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const status = useConsentStatus();

  return (
    <div>
      <button className={className || styles.button} type="button" onClick={() => setOpen((value) => !value)}>
        Configurar medição
      </button>
      {open ? (
        <div aria-live="polite" className={styles.settingsPanel}>
          <p>
            {status === "restricted"
              ? "Seu navegador sinaliza DNT ou GPC. A medição do Google permanece desativada."
              : status === "granted"
                ? "A medição opcional está permitida neste navegador."
                : status === "denied"
                  ? "A medição opcional está recusada neste navegador."
                  : "Nenhuma preferência de medição foi salva neste navegador."}
          </p>
          {status === "restricted" ? null : <ConsentChoices onComplete={() => setOpen(false)} />}
        </div>
      ) : null}
    </div>
  );
}

export function openAnalyticsConsentSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_ANALYTICS_CONSENT_SETTINGS_EVENT));
}

export { GOOGLE_ANALYTICS_CONSENT_CHANGE_EVENT };
