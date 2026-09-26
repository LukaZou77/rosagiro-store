export type PurchaseTrackingAttemptResult = {
  pending: boolean;
};

type PurchaseTrackingEventTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
};

type PurchaseTrackingLifecycleOptions = {
  target: PurchaseTrackingEventTarget;
  attempt: () => Promise<PurchaseTrackingAttemptResult>;
  retryDelay: (attempt: number) => number | null;
  consentGranted: () => boolean;
  consentChangeEvent: string;
  consentStorageKey: string;
  analyticsReadyEvent: string;
  setTimer?: (callback: () => void, delay: number) => unknown;
  clearTimer?: (timer: unknown) => void;
};

export function startPurchaseTrackingLifecycle(options: PurchaseTrackingLifecycleOptions) {
  const setTimer = options.setTimer || ((callback, delay) => window.setTimeout(callback, delay));
  const clearTimer = options.clearTimer || ((timer) => window.clearTimeout(timer as number));
  let stopped = false;
  let generation = 0;
  let timer: unknown;
  let inFlight = false;
  let restartAfterFlight = false;

  function clearScheduledRetry() {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  }

  function suspend() {
    generation += 1;
    restartAfterFlight = false;
    clearScheduledRetry();
  }

  async function runAttempt(attemptNumber: number, currentGeneration: number) {
    if (stopped || currentGeneration !== generation) return;
    if (inFlight) {
      restartAfterFlight = true;
      return;
    }

    inFlight = true;
    let result: PurchaseTrackingAttemptResult;
    try {
      result = await options.attempt();
    } catch {
      result = { pending: true };
    } finally {
      inFlight = false;
    }

    if (stopped) return;
    if (restartAfterFlight) {
      restartAfterFlight = false;
      refreshForConsent();
      return;
    }
    if (currentGeneration !== generation || !result.pending) return;
    const delay = options.retryDelay(attemptNumber);
    if (delay === null) return;
    timer = setTimer(() => {
      timer = undefined;
      void runAttempt(attemptNumber + 1, currentGeneration);
    }, delay);
  }

  function restart() {
    clearScheduledRetry();
    generation += 1;
    const currentGeneration = generation;
    if (inFlight) {
      restartAfterFlight = true;
      return;
    }
    void runAttempt(0, currentGeneration);
  }

  function refreshForConsent() {
    if (options.consentGranted()) restart();
    else suspend();
  }

  function handleStorage(event: Event) {
    if ((event as StorageEvent).key === options.consentStorageKey) refreshForConsent();
  }

  const handleConsentChange: EventListener = () => refreshForConsent();
  const handleAnalyticsReady: EventListener = () => refreshForConsent();
  const handleStorageEvent: EventListener = (event) => handleStorage(event);

  // The root bootstrap may have first run on an excluded route such as simulated payment.
  if (options.consentGranted()) options.target.dispatchEvent(new Event(options.consentChangeEvent));
  options.target.addEventListener(options.consentChangeEvent, handleConsentChange);
  options.target.addEventListener(options.analyticsReadyEvent, handleAnalyticsReady);
  options.target.addEventListener("storage", handleStorageEvent);
  restart();

  return () => {
    stopped = true;
    suspend();
    options.target.removeEventListener(options.consentChangeEvent, handleConsentChange);
    options.target.removeEventListener(options.analyticsReadyEvent, handleAnalyticsReady);
    options.target.removeEventListener("storage", handleStorageEvent);
  };
}
