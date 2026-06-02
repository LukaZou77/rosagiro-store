"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

const CUSTOMER_SESSION_KEY = "bela-viva-customer-session";

type CustomerSessionIntent = "add_to_cart" | "checkout" | "manual";

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
  requireCustomerSession: (options: { intent: CustomerSessionIntent; onSuccess?: (customer: CustomerSession) => void }) => boolean;
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
  const pendingAction = useRef<{ intent: CustomerSessionIntent; onSuccess?: (customer: CustomerSession) => void } | null>(null);
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

  useEffect(() => {
    if (open) window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [open]);

  const requireCustomerSession = useCallback((options: { intent: CustomerSessionIntent; onSuccess?: (customer: CustomerSession) => void }) => {
    if (customer) return true;
    pendingAction.current = options;
    setError("");
    setOpen(true);
    return false;
  }, [customer]);

  function closeModal() {
    pendingAction.current = null;
    setError("");
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const intent = pendingAction.current?.intent || "manual";
      const response = await fetch("/api/customers/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          whatsapp: `+55 ${whatsapp}`,
          intent
        })
      });
      const result = (await response.json()) as { customer?: CustomerSession; error?: string };

      if (!response.ok || !result.customer) {
        setError(result.error || "Nao foi possivel entrar agora.");
        return;
      }

      writeStoredCustomer(result.customer);
      setCustomer(result.customer);
      setName(result.customer.name);
      setWhatsapp(result.customer.whatsapp.replace("+55", "").trim());
      setOpen(false);
      const action = pendingAction.current;
      pendingAction.current = null;
      action?.onSuccess?.(result.customer);
    } catch {
      setError("Nao foi possivel entrar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
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
      <div className={open ? "customer-login-shell open" : "customer-login-shell"} aria-hidden={!open}>
        <button className="customer-login-overlay" type="button" onClick={closeModal} aria-label="Fechar area do login" />
        <form className="customer-login-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="customer-login-title">
          <header>
            <h2 id="customer-login-title">Entrar via WhatsApp</h2>
            <button type="button" onClick={closeModal} aria-label="Fechar login">
              x
            </button>
          </header>
          <label>
            Seu Nome <span>*</span>
            <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu Nome" required />
          </label>
          <label>
            Seu WhatsApp <span>*</span>
            <div className="whatsapp-input-row">
              <span aria-hidden="true">BR +55</span>
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(cleanPhoneInput(event.target.value))}
                inputMode="tel"
                placeholder="11 99999-9999"
                required
              />
            </div>
          </label>
          <p className="customer-login-note">
            Usamos nome e WhatsApp para atendimento, pedido e compra no atacado. Nao criamos senha nesta fase.{" "}
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
              {submitting ? "Entrando..." : "Continuar"}
            </button>
          </footer>
        </form>
      </div>
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
      onClick={() => {
        if (disabled) return;
        if (requireCustomerSession({ intent: "checkout", onSuccess: proceed })) proceed();
      }}
    >
      {children}
    </button>
  );
}
