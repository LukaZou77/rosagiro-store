"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, writeCart } from "@/components/CartCount";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import { money } from "@/lib/money";
import { paymentMethods, type PaymentMethodValue } from "@/lib/payments";
import { siteConfig } from "@/lib/site-config";

type Product = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  brand: { name: string };
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const manualCepMessage = "Preencha manualmente se o CEP nao trouxer todos os dados.";

type CepStatus = "idle" | "loading" | "success" | "not-found" | "error";

type AddressState = {
  cep: string;
  state: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
};

type AutoFillField = "state" | "street" | "district" | "city";

const emptyAutofillFields: Record<AutoFillField, boolean> = {
  state: false,
  street: false,
  district: false,
  city: false
};

export function CheckoutClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const cart = useCart();
  const [shippingMethod, setShippingMethod] = useState<"PADRAO" | "EXPRESSA">("PADRAO");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("PIX");
  const [address, setAddress] = useState<AddressState>({
    cep: "",
    state: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: ""
  });
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const [cepMessage, setCepMessage] = useState(manualCepMessage);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lastAutofilledCep = useRef("");
  const autofilledFields = useRef<Record<AutoFillField, boolean>>({ ...emptyAutofillFields });

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = cart
    .map((item) => ({ ...item, product: productMap.get(item.slug) }))
    .filter((item): item is { slug: string; quantity: number; product: Product } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal >= 29900 ? 0 : shippingMethod === "EXPRESSA" ? 2490 : 1490;
  const total = subtotal - discount + shipping;

  const clearAutofilledAddress = useCallback(() => {
    const fields = autofilledFields.current;
    setAddress((current) => ({
      ...current,
      state: fields.state ? "" : current.state,
      street: fields.street ? "" : current.street,
      district: fields.district ? "" : current.district,
      city: fields.city ? "" : current.city
    }));
    autofilledFields.current = { ...emptyAutofillFields };
    lastAutofilledCep.current = "";
  }, []);

  function updateAddress(field: keyof AddressState, value: string) {
    if (field === "cep") {
      const formattedCep = formatCep(value);
      const digits = cepDigits(formattedCep);

      if (!digits) {
        setCepStatus("idle");
        setCepMessage(manualCepMessage);
      } else if (digits.length < 8) {
        setCepStatus("idle");
        setCepMessage("Digite os 8 numeros do CEP para buscar o endereco.");
      } else {
        setCepStatus("loading");
        setCepMessage("Buscando CEP...");
      }

      setAddress((current) => ({ ...current, cep: formattedCep }));
      return;
    }

    if (field === "state" || field === "street" || field === "district" || field === "city") {
      autofilledFields.current[field] = false;
    }

    setAddress((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    const digits = cepDigits(address.cep);
    if (digits.length !== 8) return;

    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    lookupCep(digits, controller.signal)
      .then((result) => {
        if (!active) return;
        window.clearTimeout(timeoutId);
        if (result.status === "not-found") {
          if (lastAutofilledCep.current && lastAutofilledCep.current !== digits) clearAutofilledAddress();
          setCepStatus("not-found");
          setCepMessage("CEP nao encontrado, preencha manualmente.");
          return;
        }

        const nextAutofilledFields = {
          state: Boolean(result.address.state),
          street: Boolean(result.address.street),
          district: Boolean(result.address.district),
          city: Boolean(result.address.city)
        };

        setAddress((current) => ({
          ...current,
          state: result.address.state || current.state,
          street: result.address.street || current.street,
          district: result.address.district || current.district,
          city: result.address.city || current.city
        }));
        autofilledFields.current = nextAutofilledFields;
        lastAutofilledCep.current = digits;
        setCepStatus("success");
        setCepMessage("Endereco encontrado. Complete numero e complemento se necessario.");
      })
      .catch((lookupError: unknown) => {
        if (!active) return;
        window.clearTimeout(timeoutId);
        if (lookupError instanceof DOMException && lookupError.name === "AbortError" && !timedOut) return;
        if (lastAutofilledCep.current && lastAutofilledCep.current !== digits) clearAutofilledAddress();
        setCepStatus("error");
        setCepMessage("Nao foi possivel consultar agora. Preencha manualmente.");
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address.cep, clearAutofilledAddress]);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError("");
    const payload = {
      items: cart,
      customer: {
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        phone: String(formData.get("phone") || ""),
        cpf: String(formData.get("cpf") || "")
      },
      address: {
        cep: String(formData.get("cep") || ""),
        state: String(formData.get("state") || ""),
        street: String(formData.get("street") || ""),
        number: String(formData.get("number") || ""),
        complement: String(formData.get("complement") || ""),
        district: String(formData.get("district") || ""),
        city: String(formData.get("city") || "")
      },
      shippingMethod,
      paymentMethod
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as { orderNumber?: string; error?: string };
    setSubmitting(false);

    if (!response.ok || !result.orderNumber) {
      setError(result.error || "Nao foi possivel criar o pedido.");
      return;
    }

    writeCart([]);
    router.push(`/pagamento-simulado/${result.orderNumber}`);
  }

  return (
    <section className="checkout-shell">
      <form action={submit} className="checkout-form">
        <p className="eyebrow">Checkout simulado</p>
        <h1>Entrega e pagamento</h1>
        <fieldset>
          <legend>Contato</legend>
          <label>
            Nome completo <input name="name" autoComplete="name" required />
          </label>
          <label>
            E-mail <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Telefone <input name="phone" placeholder="(11) 99999-9999" required />
          </label>
          <label>
            CPF <input name="cpf" placeholder="000.000.000-00" required />
          </label>
        </fieldset>
        <fieldset>
          <legend>Endereco</legend>
          <div className="form-grid">
            <label>
              CEP
              <input
                name="cep"
                placeholder="00000-000"
                autoComplete="postal-code"
                inputMode="numeric"
                value={address.cep}
                onChange={(event) => updateAddress("cep", event.target.value)}
                required
              />
            </label>
            <label>
              Estado
              <select name="state" value={address.state} onChange={(event) => updateAddress("state", event.target.value)} required>
                <option value="">UF</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={`cep-status ${cepStatus}`} aria-live="polite">
            {cepMessage}
          </p>
          <label>
            Rua <input name="street" autoComplete="address-line1" value={address.street} onChange={(event) => updateAddress("street", event.target.value)} required />
          </label>
          <div className="form-grid">
            <label>
              Numero <input name="number" autoComplete="address-line2" value={address.number} onChange={(event) => updateAddress("number", event.target.value)} required />
            </label>
            <label>
              Complemento <input name="complement" value={address.complement} onChange={(event) => updateAddress("complement", event.target.value)} />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Bairro <input name="district" value={address.district} onChange={(event) => updateAddress("district", event.target.value)} required />
            </label>
            <label>
              Cidade <input name="city" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)} required />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Entrega</legend>
          <label className="radio-card">
            <input type="radio" name="shipping" checked={shippingMethod === "PADRAO"} onChange={() => setShippingMethod("PADRAO")} />
            <span>
              <strong>Entrega padrao</strong>
              <small>4 a 7 dias uteis / {subtotal >= 29900 ? "Gratis" : money(1490)}</small>
            </span>
          </label>
          <label className="radio-card">
            <input type="radio" name="shipping" checked={shippingMethod === "EXPRESSA"} onChange={() => setShippingMethod("EXPRESSA")} />
            <span>
              <strong>Entrega expressa</strong>
              <small>2 a 3 dias uteis / {subtotal >= 29900 ? "Gratis" : money(2490)}</small>
            </span>
          </label>
          <div className="delivery-note inline">
            {siteConfig.wholesale.deliveryModes.map((mode) => (
              <span key={mode}>{mode}</span>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Pagamento</legend>
          {paymentMethods.map((method) => (
            <label className="radio-card" key={method.value}>
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={paymentMethod === method.value}
                onChange={() => setPaymentMethod(method.value)}
              />
              <span>
                <strong>{method.label}</strong>
                <small>{method.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="form-error" role="alert">
          {error}
        </div>
        <button className="button primary wide" type="submit" disabled={submitting || !items.length}>
          {submitting ? "Criando pedido..." : "Finalizar pedido"}
        </button>
      </form>
      <aside className="summary-panel">
        <MinimumOrderNotice subtotalCents={subtotal} compact />
        <div className="summary-block">
          <h2>Resumo</h2>
          {items.map((item) => (
            <div key={item.slug}>
              <span>
                {item.quantity}x {item.product.name}
              </span>
              <strong>{money(item.product.priceCents * item.quantity)}</strong>
            </div>
          ))}
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Desconto curadoria</span>
            <strong>-{money(discount)}</strong>
          </div>
          <div>
            <span>Frete</span>
            <strong>{shipping === 0 ? "Gratis" : money(shipping)}</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
      </aside>
    </section>
  );
}
