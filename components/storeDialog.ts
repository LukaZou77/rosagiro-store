import type { KeyboardEvent } from "react";

export function wrappedDialogFocusTarget<T>(options: {
  elements: T[];
  activeElement: T | null;
  activeInside: boolean;
  shiftKey: boolean;
}) {
  const first = options.elements[0];
  const last = options.elements[options.elements.length - 1];
  if (!first || !last) return null;
  if (!options.activeInside) return options.shiftKey ? last : first;
  if (options.shiftKey && options.activeElement === first) return last;
  if (!options.shiftKey && options.activeElement === last) return first;
  return null;
}

export function trapStoreDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return;

  const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    "a[href], button, input, select, textarea, [tabindex]"
  )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible");
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const target = wrappedDialogFocusTarget({
    elements,
    activeElement,
    activeInside: Boolean(activeElement && elements.includes(activeElement)),
    shiftKey: event.shiftKey
  });
  if (!target) return;

  event.preventDefault();
  target.focus();
}

export function closeStoreDialog(dialog: HTMLDialogElement | null, opener: HTMLElement | null) {
  if (!dialog?.open) return;

  dialog.close();
  if (opener && opener !== document.body && opener !== document.documentElement) {
    opener.focus({ preventScroll: true });
    if (document.activeElement === opener) return;
  }

  const activeDialog = document.querySelector("dialog:modal");
  if (activeDialog?.contains(document.activeElement)) return;
  const fallback = activeDialog?.querySelector<HTMLElement>("button:not(:disabled)") ?? document.getElementById("conteudo-principal");
  fallback?.focus({ preventScroll: true });
}
