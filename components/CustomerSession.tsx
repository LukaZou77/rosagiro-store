"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { closeStoreDialog, trapStoreDialogFocus } from "@/components/storeDialog";

const CUSTOMER_SESSION_KEY = "bela-viva-customer-session";

type CustomerSessionIntent = "add_to_cart" | "checkout" | "manual";

type CustomerSessionOptions = {
  intent: CustomerSessionIntent;
  onSuccess?: (customer: CustomerSession) => void;
  trigger?: HTMLElement;
};

export type CustomerSession = {
  id: string;
  name: string;
  whatsapp: string;
  whatsappDigits: string;
};

type StoredCustomerSession = {
  customer: CustomerSession;
  updatedAt: string;
};

type CustomerSessionContextValue = {
  customer: CustomerSession | null;
  requireCustomerSession: (options: CustomerSessionOptions) => boolean;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

function readStoredCustomer() {
  try {
    const value = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!value) return null;
    const data = JSON.parse(value) as StoredCustomerSession;
    if (!data.customer?.id || !data.customer.name || !data.customer.whatsappDigits) return null;
    return data.customer;
  } catch {
    return null;
  }
}

function writeStoredCustomer(customer: CustomerSession) {
  localStorage.setItem(
    CUSTOMER_SESSION_KEY,
    JSON.stringify({
      customer,
      updatedAt: new Date().toISOString()
    } satisfies StoredCustomerSession)
  );
}

function cleanPhoneInput(value: string) {
  return value.replace(/[^\d()\s-]/g, "").slice(0, 20);
}

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const pendingAction = useRef<CustomerSessionOptions | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [customer, setCustomer] = useState<CustomerSession | null>(() => (typeof window === "undefined" ? null : readStoredCustomer()));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return "";
    return readStoredCustomer()?.name || "";
  });
  const [whatsapp, setWhatsapp] = useState(() => {
    if (typeof window === "undefined") return "";
    return readStoredCustomer()?.whatsapp.replace("+55", "").trim() || "";
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
    nameInputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => () => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
  }, []);

  const requireCustomerSession = useCallback((options: CustomerSessionOptions) => {
    if (customer) return true;
    if (pendingAction.current) return false;
    openerRef.current = options.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    pendingAction.current = options;
    setError("");
    setOpen(true);
    return false;
  }, [customer]);

  function closeModal() {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    pendingAction.current = null;
    setError("");
    setSubmitting(false);
    setOpen(false);
    closeStoreDialog(dialogRef.current, openerRef.current);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = pendingAction.current;
    if (!action || pendingRequest.current) return;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/customers/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          whatsapp: `+55 ${whatsapp}`,
          intent: action.intent
        })
      });
      const result = (await response.json()) as { customer?: CustomerSession; error?: string };
      if (pendingRequest.current !== controller) return;

      if (!response.ok || !result.customer) {
        setError(result.error || "Não foi possível continuar agora.");
        return;
      }

      writeStoredCustomer(result.customer);
      setCustomer(result.customer);
      setName(result.customer.name);
      setWhatsapp(result.customer.whatsapp.replace("+55", "").trim());
      pendingRequest.current = null;
      closeModal();
      action.onSuccess?.(result.customer);
    } catch {
      if (pendingRequest.current === controller) setError("Não foi possível continuar agora. Tente novamente.");
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setSubmitting(false);
      }
    }
  }

  const contextValue = useMemo(
    () => ({
      customer,
      requireCustomerSession
    }),
    [customer, requireCustomerSession]
  );

  return (
    <CustomerSessionContext.Provider value={contextValue}>
      {children}
      <dialog
        className="customer-login-shell"
        aria-labelledby="customer-login-title"
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
        onKeyDown={trapStoreDialogFocus}
      >
        <form className="customer-login-modal" onSubmit={submit}>
          <header>
            <h2 id="customer-login-title">Informe seus dados para continuar</h2>
            <button type="button" onClick={closeModal} aria-label="Fechar identificação">
              ×
            </button>
          </header>
          <label>
              <span>Seu nome <span aria-hidden="true">*</span></span>
            <input
              name="customerName"
              ref={nameInputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              required
            />
          </label>
          <div className="customer-login-field">
            <label htmlFor="customer-whatsapp">
              <span>Seu WhatsApp <span aria-hidden="true">*</span></span>
            </label>
            <div className="whatsapp-input-row">
              <span aria-hidden="true">BR +55</span>
              <input
                id="customer-whatsapp"
                name="customerWhatsapp"
                type="tel"
                value={whatsapp}
                onChange={(event) => setWhatsapp(cleanPhoneInput(event.target.value))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="11 99999-9999"
                required
              />
            </div>
          </div>
          <p className="customer-login-note">
            Informe seu nome e número de WhatsApp para continuar a compra aqui no site. Usaremos esses dados para identificar e acompanhar seu pedido.{" "}
            <Link href="/politica-de-privacidade">Privacidade</Link>
          </p>
          <div className="form-error" role="alert">
            {error}
          </div>
          <footer>
            <button className="button secondary" type="button" onClick={closeModal}>
              Cancelar
            </button>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? "Continuando..." : "Continuar no site"}
            </button>
          </footer>
        </form>
      </dialog>
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context) {
    throw new Error("useCustomerSession must be used inside CustomerSessionProvider");
  }
  return context;
}

export function CustomerCheckoutButton({
  children,
  className,
  disabled = false,
  onProceed
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onProceed?: () => void;
}) {
  const router = useRouter();
  const { requireCustomerSession } = useCustomerSession();

  function proceed() {
    onProceed?.();
    router.push("/checkout");
  }

  return (
    <button
      className={className}
      disabled={disabled}
      type="button"
      onClick={(event) => {
        if (disabled) return;
        if (requireCustomerSession({ intent: "checkout", onSuccess: proceed, trigger: event.currentTarget })) proceed();
      }}
    >
      {children}
    </button>
  );
}
