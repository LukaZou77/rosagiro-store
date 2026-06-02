"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart, writeCart } from "@/components/CartCount";
import { useCustomerSession } from "@/components/CustomerSession";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import { money } from "@/lib/money";
import { paymentMethods, type PaymentMethodValue } from "@/lib/payments";
import { siteConfig } from "@/lib/site-config";

type Product = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  weightGrams: number;
  brand: { name: string };
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const manualCepMessage = "Preencha manualmente se o CEP nao trouxer todos os dados.";

type CepStatus = "idle" | "loading" | "success" | "not-found" | "error";
type AddressSearchStatus = "idle" | "loading" | "success" | "empty" | "disabled" | "error";

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

type AddressSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

type AddressAutocompleteResponse = {
  status: "OK" | "DISABLED" | "ERROR";
  suggestions: AddressSuggestion[];
  message?: string;
};

type AddressDetailsResponse = {
  status: "OK" | "DISABLED" | "ERROR";
  formattedAddress?: string;
  address?: Partial<AddressState>;
  message?: string;
};

type CheckoutShippingMethod = "ANJUN_D2D_PICKUP" | "RETIRADA_LOCAL";

type ShippingQuoteOption = {
  method: CheckoutShippingMethod;
  carrier: string;
  service: string;
  label: string;
  priceCents: number;
  billableWeightGrams: number;
  productWeightGrams: number;
  rateId: string | null;
  zone: string | null;
  city: string | null;
  state: string | null;
  estimate: string;
  note: string;
};

type ShippingQuoteResponse = {
  status: "OK" | "NO_RATE" | "INVALID_CEP" | "EMPTY_CART" | "ERROR";
  message: string;
  options: ShippingQuoteOption[];
  productWeightGrams: number;
  billableWeightGrams: number;
};

type ShippingStatus = "idle" | "loading" | "ready" | "warning" | "error";

function makeAddressSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addressSearchReadiness(value: string, address: Pick<AddressState, "state" | "city">) {
  if (value.trim().length < 3) return "Digite pelo menos 3 caracteres para buscar sugestoes.";
  if (!address.state || address.city.trim().length < 3) return "Informe UF e cidade para buscar por rua.";
  return "";
}

export function CheckoutClient({ products, trustSignals }: { products: Product[]; trustSignals: string[] }) {
  const router = useRouter();
  const cart = useCart();
  const { customer, requireCustomerSession } = useCustomerSession();
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [contactTouched, setContactTouched] = useState({ name: false, phone: false });
  const [shippingMethod, setShippingMethod] = useState<CheckoutShippingMethod>("RETIRADA_LOCAL");
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
  const [addressSearch, setAddressSearch] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchStatus, setAddressSearchStatus] = useState<AddressSearchStatus>("idle");
  const [addressSearchMessage, setAddressSearchMessage] = useState("Digite rua, bairro ou cidade para buscar sugestoes.");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuoteResponse | null>(null);
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("idle");
  const [shippingMessage, setShippingMessage] = useState("Informe o CEP para estimar Anjun D2D Pickup.");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const addressSessionToken = useRef(makeAddressSessionToken());
  const skipNextAddressSearch = useRef(false);
  const lastAutofilledCep = useRef("");
  const autofilledFields = useRef<Record<AutoFillField, boolean>>({ ...emptyAutofillFields });

  const productMap = useMemo(() => new Map(products.map((product) => [product.slug, product])), [products]);
  const items = useMemo(
    () =>
      cart
        .map((item) => ({ ...item, product: productMap.get(item.slug) }))
        .filter((item): item is { slug: string; quantity: number; product: Product } => Boolean(item.product)),
    [cart, productMap]
  );
  const quoteItems = useMemo(() => items.map((item) => ({ slug: item.slug, quantity: item.quantity })), [items]);
  const subtotal = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const discount = subtotal >= 25000 ? Math.round(subtotal * 0.1) : 0;
  const selectedShipping = shippingQuote?.options.find((option) => option.method === shippingMethod) || null;
  const shipping = selectedShipping?.priceCents || 0;
  const total = subtotal - discount + shipping;
  const contactValue = useMemo(
    () => ({
      name: contactTouched.name ? contact.name : contact.name || customer?.name || "",
      phone: contactTouched.phone ? contact.phone : contact.phone || customer?.whatsapp || ""
    }),
    [contact, contactTouched, customer]
  );

  const prefillContactFromCustomer = useCallback((nextCustomer: { name: string; whatsapp: string }) => {
    setContact((current) => ({
      name: current.name || nextCustomer.name,
      phone: current.phone || nextCustomer.whatsapp
    }));
  }, []);

  useEffect(() => {
    if (!items.length || customer) return;
    requireCustomerSession({ intent: "checkout", onSuccess: prefillContactFromCustomer });
  }, [customer, items.length, prefillContactFromCustomer, requireCustomerSession]);

  function updateContact(field: "name" | "phone", value: string) {
    setContact((current) => ({ ...current, [field]: value }));
    setContactTouched((current) => ({ ...current, [field]: true }));
  }

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
    const nextAddress = { ...address, [field]: value };

    if (field === "cep") {
      const formattedCep = formatCep(value);
      const digits = cepDigits(formattedCep);

      if (!digits) {
        setCepStatus("idle");
        setCepMessage(manualCepMessage);
        setShippingQuote(null);
        setShippingMethod("RETIRADA_LOCAL");
        setShippingStatus("idle");
        setShippingMessage("Informe o CEP para estimar Anjun D2D Pickup.");
      } else if (digits.length < 8) {
        setCepStatus("idle");
        setCepMessage("Digite os 8 numeros do CEP para buscar o endereco.");
        setShippingQuote(null);
        setShippingMethod("RETIRADA_LOCAL");
        setShippingStatus("idle");
        setShippingMessage("Informe o CEP com 8 digitos para estimar Anjun D2D Pickup.");
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

    if ((field === "state" || field === "city") && addressSearch.trim().length >= 3) {
      const readinessMessage = addressSearchReadiness(addressSearch, nextAddress);
      if (readinessMessage) {
        setAddressSuggestions([]);
        setActiveSuggestionIndex(-1);
        setAddressSearchStatus("disabled");
        setAddressSearchMessage(readinessMessage);
      }
    }

    setAddress((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    const query = addressSearch.trim();

    if (skipNextAddressSearch.current) {
      skipNextAddressSearch.current = false;
      return;
    }

    if (query.length < 3) {
      return;
    }

    const readinessMessage = addressSearchReadiness(query, { state: address.state, city: address.city });
    if (readinessMessage) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    let timeoutId: number | undefined;
    const debounce = window.setTimeout(() => {
      setAddressSearchStatus("loading");
      setAddressSearchMessage("Buscando enderecos...");
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
        if (!active) return;
        setAddressSuggestions([]);
        setActiveSuggestionIndex(-1);
        setAddressSearchStatus("error");
        setAddressSearchMessage("Busca demorou demais. Use o CEP ou preencha manualmente.");
      }, 6000);

      fetch("/api/address/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: query,
          state: address.state,
          city: address.city,
          sessionToken: addressSessionToken.current
        }),
        signal: controller.signal
      })
        .then(async (response) => {
          const result = (await response.json()) as AddressAutocompleteResponse;
          if (!active) return;
          if (timeoutId) window.clearTimeout(timeoutId);

          if (result.status === "DISABLED") {
            setAddressSuggestions([]);
            setActiveSuggestionIndex(-1);
            setAddressSearchStatus("disabled");
            setAddressSearchMessage(result.message || "Busca por endereco indisponivel agora. Use o CEP ou preencha manualmente.");
            return;
          }

          if (!response.ok || result.status === "ERROR") {
            setAddressSuggestions([]);
            setActiveSuggestionIndex(-1);
            setAddressSearchStatus("error");
            setAddressSearchMessage(result.message || "Nao foi possivel buscar sugestoes agora. Preencha manualmente.");
            return;
          }

          setAddressSuggestions(result.suggestions);
          setActiveSuggestionIndex(result.suggestions.length ? 0 : -1);
          setAddressSearchStatus(result.suggestions.length ? "success" : "empty");
          setAddressSearchMessage(result.suggestions.length ? "Selecione uma sugestao para preencher o endereco." : "Nenhuma sugestao encontrada. Voce pode preencher manualmente.");
        })
        .catch((autocompleteError: unknown) => {
          if (!active) return;
          if (timeoutId) window.clearTimeout(timeoutId);
          if (autocompleteError instanceof DOMException && autocompleteError.name === "AbortError" && !timedOut) return;
          setAddressSuggestions([]);
          setActiveSuggestionIndex(-1);
          setAddressSearchStatus("error");
          setAddressSearchMessage(timedOut ? "Busca demorou demais. Use o CEP ou preencha manualmente." : "Nao foi possivel buscar sugestoes agora. Preencha manualmente.");
        });
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(debounce);
      if (timeoutId) window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address.city, address.state, addressSearch]);

  function handleAddressSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setAddressSearch(value);

    const readinessMessage = addressSearchReadiness(value, address);
    if (readinessMessage) {
      setAddressSuggestions([]);
      setActiveSuggestionIndex(-1);
      setAddressSearchStatus(value.trim().length < 3 ? "idle" : "disabled");
      setAddressSearchMessage(readinessMessage);
    }
  }

  async function selectAddressSuggestion(suggestion: AddressSuggestion) {
    skipNextAddressSearch.current = true;
    setAddressSearch(suggestion.fullText);
    setAddressSuggestions([]);
    setActiveSuggestionIndex(-1);
    setAddressSearchStatus("loading");
    setAddressSearchMessage("Carregando endereco selecionado...");

    try {
      const response = await fetch("/api/address/place-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: addressSessionToken.current
        })
      });
      const result = (await response.json()) as AddressDetailsResponse;
      addressSessionToken.current = makeAddressSessionToken();

      if (!response.ok || result.status !== "OK") {
        setAddressSearchStatus(result.status === "DISABLED" ? "disabled" : "error");
        setAddressSearchMessage(result.message || "Nao foi possivel carregar o endereco selecionado. Preencha manualmente.");
        return;
      }

      const nextAddress = result.address || {};
      const formattedCep = nextAddress.cep ? formatCep(nextAddress.cep) : "";
      const nextAutofilledFields = {
        state: Boolean(nextAddress.state),
        street: Boolean(nextAddress.street),
        district: Boolean(nextAddress.district),
        city: Boolean(nextAddress.city)
      };

      setAddress((current) => ({
        ...current,
        cep: formattedCep || current.cep,
        state: nextAddress.state || current.state,
        street: nextAddress.street || current.street,
        number: nextAddress.number || current.number,
        district: nextAddress.district || current.district,
        city: nextAddress.city || current.city
      }));
      autofilledFields.current = nextAutofilledFields;
      if (formattedCep) lastAutofilledCep.current = cepDigits(formattedCep);
      setAddressSearchStatus("success");
      setAddressSearchMessage("Endereco selecionado. Confira numero e complemento antes de finalizar.");
      if (formattedCep) {
        setCepStatus("success");
        setCepMessage("Endereco encontrado. Complete numero e complemento se necessario.");
      }
    } catch {
      addressSessionToken.current = makeAddressSessionToken();
      setAddressSearchStatus("error");
      setAddressSearchMessage("Nao foi possivel carregar o endereco selecionado. Preencha manualmente.");
    }
  }

  function handleAddressSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!addressSuggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % addressSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current <= 0 ? addressSuggestions.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = addressSuggestions[activeSuggestionIndex];
      if (suggestion) void selectAddressSuggestion(suggestion);
    } else if (event.key === "Escape") {
      setAddressSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
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

  useEffect(() => {
    const digits = cepDigits(address.cep);
    if (!quoteItems.length) {
      return;
    }

    if (digits.length !== 8) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const loadingId = window.setTimeout(() => {
      if (!active) return;
      setShippingStatus("loading");
      setShippingMessage("Calculando frete por CEP e peso...");
    }, 0);

    fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: quoteItems, cep: digits }),
      signal: controller.signal
    })
      .then(async (response) => {
        const result = (await response.json()) as ShippingQuoteResponse;
        if (!active) return;
        window.clearTimeout(loadingId);

        if (!response.ok || result.status === "ERROR") {
          setShippingQuote(null);
          setShippingMethod("RETIRADA_LOCAL");
          setShippingStatus("error");
          setShippingMessage(result.message || "Nao foi possivel calcular o frete agora.");
          return;
        }

        const anjunOption = result.options.find((option) => option.method === "ANJUN_D2D_PICKUP");
        setShippingQuote(result);
        setShippingMethod((current) => {
          if (current === "ANJUN_D2D_PICKUP" && anjunOption) return current;
          return anjunOption ? "ANJUN_D2D_PICKUP" : "RETIRADA_LOCAL";
        });
        setShippingStatus(result.status === "OK" ? "ready" : "warning");
        setShippingMessage(anjunOption || result.options.length ? result.message : "Escolha retirada local ou consulte o atendimento.");
      })
      .catch((quoteError: unknown) => {
        if (!active) return;
        window.clearTimeout(loadingId);
        if (quoteError instanceof DOMException && quoteError.name === "AbortError") return;
        setShippingQuote(null);
        setShippingMethod("RETIRADA_LOCAL");
        setShippingStatus("error");
        setShippingMessage("Nao foi possivel calcular o frete agora. Retirada local segue disponivel.");
      });

    return () => {
      active = false;
      window.clearTimeout(loadingId);
      controller.abort();
    };
  }, [address.cep, quoteItems]);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError("");
    if (!customer) {
      setSubmitting(false);
      setError("Entre via WhatsApp para continuar o checkout.");
      requireCustomerSession({ intent: "checkout", onSuccess: prefillContactFromCustomer });
      return;
    }

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
    const result = (await response.json()) as { orderNumber?: string; redirectTo?: string; externalRedirect?: boolean; error?: string };
    setSubmitting(false);

    if (!response.ok || !result.orderNumber || !result.redirectTo) {
      setError(result.error || "Nao foi possivel criar o pedido.");
      return;
    }

    writeCart([]);
    if (result.externalRedirect) {
      window.location.assign(result.redirectTo);
      return;
    }
    router.push(result.redirectTo);
  }

  return (
    <section className="checkout-shell">
      <form action={submit} className="checkout-form" id="checkout-form">
        <p className="eyebrow">Checkout Bela Viva</p>
        <h1>Entrega e pagamento</h1>
        <fieldset>
          <legend>Contato</legend>
          <label>
            Nome completo{" "}
            <input
              name="name"
              autoComplete="name"
              value={contactValue.name}
              onChange={(event) => updateContact("name", event.target.value)}
              required
            />
          </label>
          <label>
            E-mail <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            WhatsApp{" "}
            <input
              name="phone"
              placeholder="(11) 99999-9999"
              value={contactValue.phone}
              onChange={(event) => updateContact("phone", event.target.value)}
              required
            />
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
            Cidade <input name="city" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)} required />
          </label>
          <div className="address-search">
            <label htmlFor="address-search-input">Buscar rua pelo ViaCEP</label>
            <div className="address-search-box">
              <input
                id="address-search-input"
                type="search"
                placeholder="Digite o nome da rua"
                value={addressSearch}
                onChange={handleAddressSearchChange}
                onKeyDown={handleAddressSearchKeyDown}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={addressSuggestions.length > 0}
                aria-controls="address-suggestions"
                aria-activedescendant={activeSuggestionIndex >= 0 ? `address-suggestion-${activeSuggestionIndex}` : undefined}
                autoComplete="off"
              />
              <span aria-hidden="true">Buscar</span>
            </div>
            {addressSuggestions.length > 0 ? (
              <ul className="address-suggestions" id="address-suggestions" role="listbox">
                {addressSuggestions.map((suggestion, index) => (
                  <li
                    id={`address-suggestion-${index}`}
                    key={suggestion.placeId}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onClick={() => void selectAddressSuggestion(suggestion)}
                    >
                      <span className="suggestion-marker" aria-hidden="true" />
                      <span>
                        <strong>{suggestion.mainText}</strong>
                        <small>{suggestion.secondaryText || suggestion.fullText}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={`address-search-status ${addressSearchStatus}`} aria-live="polite">
              {addressSearchMessage}
            </p>
          </div>
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
          </div>
        </fieldset>
        <fieldset>
          <legend>Entrega</legend>
          <p className={`cep-status shipping-status ${shippingStatus}`} aria-live="polite">
            {shippingMessage}
          </p>
          {shippingQuote?.options.length ? (
            shippingQuote.options.map((option) => (
              <label className="radio-card" key={option.method}>
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === option.method}
                  onChange={() => setShippingMethod(option.method)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>
                    {option.priceCents === 0 ? "R$ 0,00" : money(option.priceCents)} / peso cobrado{" "}
                    {(option.billableWeightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg
                  </small>
                  <small>{option.zone ? `${option.city}/${option.state} - ${option.zone}` : option.estimate}</small>
                </span>
              </label>
            ))
          ) : (
            <label className="radio-card">
              <input
                type="radio"
                name="shipping"
                checked={shippingMethod === "RETIRADA_LOCAL"}
                onChange={() => setShippingMethod("RETIRADA_LOCAL")}
              />
              <span>
                <strong>Retirada local</strong>
                <small>R$ 0,00 / combine pelo atendimento</small>
              </span>
            </label>
          )}
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
        <StoreTrustSignals signals={trustSignals} compact />
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
            <span>Frete base</span>
            <strong>{shipping === 0 ? "R$ 0,00" : money(shipping)}</strong>
          </div>
          {selectedShipping ? <p>{selectedShipping.note}</p> : <p>Frete Anjun sera calculado apos informar o CEP.</p>}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
      </aside>
      <div className="mobile-checkout-bar" aria-label="Resumo rapido do checkout">
        <div>
          <span>{siteConfig.mobilePurchase.checkoutBarLabel}</span>
          <strong>{money(total)}</strong>
        </div>
        <button className="button primary" type="submit" form="checkout-form" disabled={submitting || !items.length}>
          {submitting ? "Criando..." : siteConfig.mobilePurchase.checkoutSubmit}
        </button>
      </div>
    </section>
  );
}
