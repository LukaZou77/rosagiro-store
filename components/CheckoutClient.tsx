"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, writeCart } from "@/components/CartCount";
import { money } from "@/lib/money";
import { paymentMethods, type PaymentMethodValue } from "@/lib/payments";

type Product = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  brand: { name: string };
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function CheckoutClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const cart = useCart();
  const [shippingMethod, setShippingMethod] = useState<"PADRAO" | "EXPRESSA">("PADRAO");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("PIX");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = cart
    .map((item) => ({ ...item, product: productMap.get(item.slug) }))
    .filter((item): item is { slug: string; quantity: number; product: Product } => Boolean(item.product));
  const subtotal = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const shipping = subtotal >= 29900 ? 0 : shippingMethod === "EXPRESSA" ? 2490 : 1490;
  const total = subtotal - discount + shipping;

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
              CEP <input name="cep" placeholder="00000-000" required />
            </label>
            <label>
              Estado
              <select name="state" required>
                <option value="">UF</option>
                {states.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Rua <input name="street" required />
          </label>
          <div className="form-grid">
            <label>
              Numero <input name="number" required />
            </label>
            <label>
              Complemento <input name="complement" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Bairro <input name="district" required />
            </label>
            <label>
              Cidade <input name="city" required />
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
