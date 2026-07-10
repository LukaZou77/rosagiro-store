"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cartLineKey, useCart, writeCart } from "@/components/CartCount";
import { CartCompletionRecommendations } from "@/components/CartCompletionRecommendations";
import { useCustomerSession } from "@/components/CustomerSession";
import { MinimumOrderNotice } from "@/components/MinimumOrderNotice";
import { StoreTrustSignals } from "@/components/StoreTrustSignals";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { useWhatsAppPhone } from "@/components/WhatsAppProvider";
import type { CartSummary } from "@/lib/cart-summary";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import { money } from "@/lib/money";
import { paymentMethodsForCheckout, type PaymentMethodValue } from "@/lib/payments";
import { siteConfig } from "@/lib/site-config";
import { buildCartWhatsAppHref, buildGeneralWhatsAppHref } from "@/lib/whatsapp";
import { readAttribution, trackCommerceOnce } from "@/lib/commerce-analytics";

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const manualCepMessage = "Preencha manualmente se o CEP não trouxer todos os dados.";
const checkoutStepOrder = ["contact", "address", "payment"] as const;

type CheckoutStep = (typeof checkoutStepOrder)[number];
type ContactField = "name" | "phone" | "email" | "cpf";

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
  if (value.trim().length < 3) return "Digite pelo menos 3 caracteres para buscar sugestões.";
  if (!address.state || address.city.trim().length < 3) return "Informe UF e cidade para buscar por rua.";
  return "";
}

function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function stepIndex(step: CheckoutStep) {
  return checkoutStepOrder.indexOf(step);
}

export function CheckoutClient({
  trustSignals,
  mercadoPagoMaxInstallments,
  includeSimulatedPayment
}: {
  trustSignals: string[];
  mercadoPagoMaxInstallments: number;
  includeSimulatedPayment: boolean;
}) {
  const whatsappPhone = useWhatsAppPhone();
  const router = useRouter();
  const cart = useCart();
  const cartKey = useMemo(() => JSON.stringify(cart), [cart]);
  const { customer, requireCustomerSession } = useCustomerSession();
  const [contact, setContact] = useState({ name: "", phone: "", email: "", cpf: "" });
  const [contactTouched, setContactTouched] = useState({ name: false, phone: false });
  const [activeStep, setActiveStep] = useState<CheckoutStep>("contact");
  const [stepError, setStepError] = useState("");
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
  const [addressSearchMessage, setAddressSearchMessage] = useState("Digite rua, bairro ou cidade para buscar sugestões.");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuoteResponse | null>(null);
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("idle");
  const [shippingMessage, setShippingMessage] = useState("Informe o CEP para estimar Anjun D2D Pickup.");
  const [mobileFieldFocused, setMobileFieldFocused] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summaryState, setSummaryState] = useState<{ key: string; data: CartSummary } | null>(null);
  const [summaryError, setSummaryError] = useState<{ key: string; message: string } | null>(null);
  const addressSessionToken = useRef(makeAddressSessionToken());
  const formRef = useRef<HTMLFormElement>(null);
  const skipNextAddressSearch = useRef(false);
  const lastAutofilledCep = useRef("");
  const autofilledFields = useRef<Record<AutoFillField, boolean>>({ ...emptyAutofillFields });

  useEffect(() => {
    if (!cart.length) {
      return;
    }

    const controller = new AbortController();
    fetch("/api/cart/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as CartSummary;
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o resumo do pedido.");
        setSummaryState({ key: cartKey, data });
        setSummaryError(null);
      })
      .catch((fetchError: Error) => {
        if (fetchError.name === "AbortError") return;
        setSummaryError({ key: cartKey, message: fetchError.message || "Não foi possível carregar o resumo do pedido." });
      });

    return () => controller.abort();
  }, [cart, cartKey]);

  const summary = cart.length && summaryState?.key === cartKey ? summaryState.data : null;
  const summaryLoadError = cart.length && summaryError?.key === cartKey ? summaryError.message : "";
  const summaryLoading = cart.length > 0 && !summary && !summaryLoadError;
  const items = useMemo(() => (summary?.lines ?? []).filter((line) => line.available && line.quantity > 0), [summary]);
  const quoteItems = useMemo(() => items.map((item) => ({ slug: item.slug, skuId: item.skuId || undefined, quantity: item.quantity })), [items]);
  const subtotal = summary?.subtotalCents || 0;
  const minimumReached = summary?.minimumReached ?? subtotal >= siteConfig.wholesale.minimumOrderCents;
  const recommendations = summary?.recommendations || [];
  const checkoutPaymentMethods = useMemo(
    () => paymentMethodsForCheckout(mercadoPagoMaxInstallments, { includeSimulated: includeSimulatedPayment }),
    [includeSimulatedPayment, mercadoPagoMaxInstallments]
  );
  const selectedShipping = shippingQuote?.options.find((option) => option.method === shippingMethod) || null;
  const shipping = selectedShipping?.priceCents || 0;
  const total = subtotal + shipping;
  const emptyCheckoutWhatsAppHref = useMemo(() => buildGeneralWhatsAppHref("checkout sem itens", whatsappPhone), [whatsappPhone]);
  const checkoutWhatsAppItems = useMemo(
    () =>
      items.map((item) => ({
        quantity: item.quantity,
        product: {
          name: item.skuName ? `${item.name} - ${item.skuName}` : item.name,
          priceCents: item.priceCents,
          brand: { name: item.brandName }
        }
      })),
    [items]
  );
  const checkoutWhatsAppHref = useMemo(
    () => buildCartWhatsAppHref(checkoutWhatsAppItems, subtotal, whatsappPhone),
    [checkoutWhatsAppItems, subtotal, whatsappPhone]
  );
  const contactValue = useMemo(
    () => ({
      name: contactTouched.name ? contact.name : contact.name || customer?.name || "",
      phone: contactTouched.phone ? contact.phone : contact.phone || customer?.whatsapp || "",
      email: contact.email,
      cpf: contact.cpf
    }),
    [contact, contactTouched, customer]
  );
  const contactComplete =
    contactValue.name.trim().length >= 2 &&
    emailLooksValid(contactValue.email) &&
    cleanDigits(contactValue.phone).length >= 10 &&
    cleanDigits(contactValue.cpf).length >= 11;
  const addressComplete =
    cepDigits(address.cep).length === 8 &&
    Boolean(address.state) &&
    address.city.trim().length > 0 &&
    address.street.trim().length > 0 &&
    address.number.trim().length > 0 &&
    address.district.trim().length > 0;
  const paymentComplete = contactComplete && addressComplete && Boolean(paymentMethod);
  const stepComplete: Record<CheckoutStep, boolean> = {
    contact: contactComplete,
    address: addressComplete,
    payment: paymentComplete
  };
  const paymentLabel = checkoutPaymentMethods.find((method) => method.value === paymentMethod)?.label || "Pagamento";

  useEffect(() => {
    if (!items.length || !summary) return;
    trackCommerceOnce(`begin_checkout:${cartKey}`, "begin_checkout", {
      currency: "BRL",
      value: subtotal / 100,
      items: items.map((item) => ({
        item_id: item.slug,
        item_name: item.name,
        item_brand: item.brandName,
        item_variant: item.skuName || undefined,
        price: item.priceCents / 100,
        quantity: item.quantity
      }))
    });
  }, [cartKey, items, subtotal, summary]);
  const stepSummaries: Record<CheckoutStep, string> = {
    contact: contactComplete
      ? `${contactValue.name.trim()} · ${contactValue.phone.trim()}`
      : siteConfig.checkout.steps.contact.summary,
    address: addressComplete
      ? `${address.city.trim()}/${address.state} · ${address.cep}`
      : siteConfig.checkout.steps.address.summary,
    payment: `${paymentLabel} · ${selectedShipping?.label || "Retirada local ou consulta"}`
  };
  const currentStepIndex = stepIndex(activeStep);
  const checkoutStepCards = checkoutStepOrder.map((step, index) => ({
    id: step,
    number: index + 1,
    title: siteConfig.checkout.steps[step].title,
    summary: stepSummaries[step],
    complete: stepComplete[step],
    active: activeStep === step,
    unlocked: index === 0 || checkoutStepOrder.slice(0, index).every((previousStep) => stepComplete[previousStep])
  }));
  const mobileCheckoutActionLabel =
    activeStep === "payment" ? siteConfig.checkout.finalCta : siteConfig.checkout.nextCta;
  const mobileCheckoutBarLabel = mobileFieldFocused
    ? siteConfig.checkout.mobile.editingLabel
    : siteConfig.mobilePurchase.checkoutBarLabel;

  const prefillContactFromCustomer = useCallback((nextCustomer: { name: string; whatsapp: string }) => {
    setContact((current) => ({
      ...current,
      name: current.name || nextCustomer.name,
      phone: current.phone || nextCustomer.whatsapp
    }));
  }, []);

  useEffect(() => {
    if (!items.length || customer) return;
    requireCustomerSession({ intent: "checkout", onSuccess: prefillContactFromCustomer });
  }, [customer, items.length, prefillContactFromCustomer, requireCustomerSession]);

  function updateContact(field: ContactField, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
    if (field === "name" || field === "phone") {
      setContactTouched((current) => ({ ...current, [field]: true }));
    }
  }

  function scrollToCheckoutStep(step: CheckoutStep) {
    const target = document.querySelector(`[data-checkout-step="${step}"]`);
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    target?.scrollIntoView({ block: "start", behavior });
  }

  function focusCheckoutField(name: string) {
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`);
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    field?.scrollIntoView({ block: "center", behavior });
    field?.focus({ preventScroll: true });
  }

  function failStep(step: CheckoutStep, message: string, fieldName?: string) {
    setActiveStep(step);
    setStepError(message);
    window.setTimeout(() => {
      if (fieldName) {
        focusCheckoutField(fieldName);
        return;
      }
      scrollToCheckoutStep(step);
    }, 0);
    return false;
  }

  function handleCheckoutFocus(event: FocusEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea")) {
      setMobileFieldFocused(true);
    }
  }

  function handleCheckoutBlur(event: FocusEvent<HTMLFormElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof HTMLElement &&
      event.currentTarget.contains(nextTarget) &&
      nextTarget.matches("input, select, textarea")
    ) {
      return;
    }

    window.setTimeout(() => {
      const activeElement = document.activeElement;
      setMobileFieldFocused(
        activeElement instanceof HTMLElement &&
          Boolean(formRef.current?.contains(activeElement)) &&
          activeElement.matches("input, select, textarea")
      );
    }, 0);
  }

  function validateCheckoutStep(step: CheckoutStep) {
    if (step === "contact") {
      if (contactValue.name.trim().length < 2) return failStep("contact", siteConfig.checkout.validation.name, "name");
      if (!emailLooksValid(contactValue.email)) return failStep("contact", siteConfig.checkout.validation.email, "email");
      if (cleanDigits(contactValue.phone).length < 10) return failStep("contact", siteConfig.checkout.validation.phone, "phone");
      if (cleanDigits(contactValue.cpf).length < 11) return failStep("contact", siteConfig.checkout.validation.cpf, "cpf");
    }

    if (step === "address") {
      if (cepDigits(address.cep).length !== 8) return failStep("address", siteConfig.checkout.validation.cep, "cep");
      if (!address.state) return failStep("address", siteConfig.checkout.validation.state, "state");
      if (!address.city.trim()) return failStep("address", siteConfig.checkout.validation.city, "city");
      if (!address.street.trim()) return failStep("address", siteConfig.checkout.validation.street, "street");
      if (!address.number.trim()) return failStep("address", siteConfig.checkout.validation.number, "number");
      if (!address.district.trim()) return failStep("address", siteConfig.checkout.validation.district, "district");
    }

    if (step === "payment" && !paymentMethod) {
      return failStep("payment", siteConfig.checkout.validation.payment);
    }

    setStepError("");
    return true;
  }

  function goToStep(step: CheckoutStep) {
    const targetIndex = stepIndex(step);
    const firstLockedPrevious = checkoutStepOrder
      .slice(0, targetIndex)
      .find((previousStep) => !stepComplete[previousStep]);

    if (firstLockedPrevious) {
      validateCheckoutStep(firstLockedPrevious);
      return;
    }

    setStepError("");
    setActiveStep(step);
    window.setTimeout(() => scrollToCheckoutStep(step), 0);
  }

  function goToNextStep() {
    if (!validateCheckoutStep(activeStep)) return;
    const nextStep = checkoutStepOrder[currentStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep);
      window.setTimeout(() => scrollToCheckoutStep(nextStep), 0);
    }
  }

  function handleMobileCheckoutAction() {
    if (activeStep === "payment") {
      formRef.current?.requestSubmit();
      return;
    }

    goToNextStep();
  }

  function checkoutStepClass(step: CheckoutStep) {
    const classes = ["checkout-step", `checkout-step-${step}`];
    if (activeStep === step) classes.push("is-active");
    if (activeStep !== step) classes.push("is-collapsed");
    if (stepComplete[step]) classes.push("is-complete");
    return classes.join(" ");
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
        setCepMessage("Digite os 8 números do CEP para buscar o endereço.");
        setShippingQuote(null);
        setShippingMethod("RETIRADA_LOCAL");
        setShippingStatus("idle");
        setShippingMessage("Informe o CEP com 8 dígitos para estimar Anjun D2D Pickup.");
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
      setAddressSearchMessage("Buscando endereços...");
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
            setAddressSearchMessage(result.message || "Busca por endereço indisponível agora. Use o CEP ou preencha manualmente.");
            return;
          }

          if (!response.ok || result.status === "ERROR") {
            setAddressSuggestions([]);
            setActiveSuggestionIndex(-1);
            setAddressSearchStatus("error");
            setAddressSearchMessage(result.message || "Não foi possível buscar sugestões agora. Preencha manualmente.");
            return;
          }

          setAddressSuggestions(result.suggestions);
          setActiveSuggestionIndex(result.suggestions.length ? 0 : -1);
          setAddressSearchStatus(result.suggestions.length ? "success" : "empty");
          setAddressSearchMessage(result.suggestions.length ? "Selecione uma sugestão para preencher o endereço." : "Nenhuma sugestão encontrada. Você pode preencher manualmente.");
        })
        .catch((autocompleteError: unknown) => {
          if (!active) return;
          if (timeoutId) window.clearTimeout(timeoutId);
          if (autocompleteError instanceof DOMException && autocompleteError.name === "AbortError" && !timedOut) return;
          setAddressSuggestions([]);
          setActiveSuggestionIndex(-1);
          setAddressSearchStatus("error");
          setAddressSearchMessage(timedOut ? "Busca demorou demais. Use o CEP ou preencha manualmente." : "Não foi possível buscar sugestões agora. Preencha manualmente.");
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
    setAddressSearchMessage("Carregando endereço selecionado...");

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
        setAddressSearchMessage(result.message || "Não foi possível carregar o endereço selecionado. Preencha manualmente.");
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
      setAddressSearchMessage("Endereço selecionado. Confira número e complemento antes de finalizar.");
      if (formattedCep) {
        setCepStatus("success");
        setCepMessage("Endereço encontrado. Complete número e complemento se necessário.");
      }
    } catch {
      addressSessionToken.current = makeAddressSessionToken();
      setAddressSearchStatus("error");
      setAddressSearchMessage("Não foi possível carregar o endereço selecionado. Preencha manualmente.");
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
          setCepMessage("CEP não encontrado, preencha manualmente.");
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
        setCepMessage("Endereço encontrado. Complete número e complemento se necessário.");
      })
      .catch((lookupError: unknown) => {
        if (!active) return;
        window.clearTimeout(timeoutId);
        if (lookupError instanceof DOMException && lookupError.name === "AbortError" && !timedOut) return;
        if (lastAutofilledCep.current && lastAutofilledCep.current !== digits) clearAutofilledAddress();
        setCepStatus("error");
        setCepMessage("Não foi possível consultar agora. Preencha manualmente.");
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
          setShippingMessage(result.message || "Não foi possível calcular o frete agora.");
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
        setShippingMessage("Não foi possível calcular o frete agora. Retirada local segue disponível.");
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
    for (const step of checkoutStepOrder) {
      if (!validateCheckoutStep(step)) {
        setSubmitting(false);
        return;
      }
    }

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
      paymentMethod,
      attribution: readAttribution()
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as { orderNumber?: string; redirectTo?: string; externalRedirect?: boolean; error?: string };
    setSubmitting(false);

    if (!response.ok || !result.orderNumber || !result.redirectTo) {
      setError(result.error || "Não foi possível criar o pedido.");
      return;
    }

    writeCart([]);
    if (result.externalRedirect) {
      window.location.assign(result.redirectTo);
      return;
    }
    router.push(result.redirectTo);
  }

  if (summaryLoading) {
    return (
      <section className="checkout-shell empty-checkout-shell">
        <div className="cart-panel empty-checkout-card">
          <p className="eyebrow">Checkout RosaGiro</p>
          <h1>Carregando seu pedido.</h1>
          <p>Estamos conferindo preços, SKU e disponibilidade antes de abrir o checkout.</p>
          <MinimumOrderNotice subtotalCents={0} />
        </div>
        <aside className="summary-panel">
          <StoreTrustSignals signals={trustSignals} compact />
        </aside>
      </section>
    );
  }

  if (summaryLoadError) {
    return (
      <section className="checkout-shell empty-checkout-shell">
        <div className="cart-panel empty-checkout-card">
          <p className="eyebrow">Checkout RosaGiro</p>
          <h1>Resumo indisponível.</h1>
          <p>{summaryLoadError}</p>
          <div className="empty-actions">
            <Link className="button primary" href="/carrinho">
              Voltar ao carrinho
            </Link>
            <WhatsAppLink className="button whatsapp" href={emptyCheckoutWhatsAppHref}>
              Falar no WhatsApp
            </WhatsAppLink>
          </div>
        </div>
        <aside className="summary-panel">
          <StoreTrustSignals signals={trustSignals} compact />
        </aside>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="checkout-shell empty-checkout-shell">
        <div className="cart-panel empty-checkout-card">
          <p className="eyebrow">Checkout RosaGiro</p>
          <h1>Monte sua lista antes de finalizar.</h1>
          <p>
            Seu carrinho está vazio. Escolha produtos do catálogo ou fale no WhatsApp para receber sugestões de kits,
            produtos em estoque e itens para completar o pedido mínimo.
          </p>
          <MinimumOrderNotice subtotalCents={0} />
          <div className="empty-actions">
            <Link className="button primary" href="/categoria/all">
              Explorar catálogo
            </Link>
            <Link className="button secondary" href="/promocoes">
              Ver destaques
            </Link>
            <WhatsAppLink className="button whatsapp" href={emptyCheckoutWhatsAppHref}>
              Falar no WhatsApp
            </WhatsAppLink>
          </div>
        </div>
        <aside className="summary-panel">
          <StoreTrustSignals signals={trustSignals} compact />
          <div className="delivery-note">
            {siteConfig.wholesale.deliveryModes.map((mode) => (
              <span key={mode}>{mode}</span>
            ))}
          </div>
        </aside>
      </section>
    );
  }

  return (
    <section className="checkout-shell">
      <form
        action={submit}
        className="checkout-form"
        id="checkout-form"
        ref={formRef}
        onFocus={handleCheckoutFocus}
        onBlur={handleCheckoutBlur}
        noValidate
      >
        <p className="eyebrow">Checkout RosaGiro</p>
        <h1>Entrega e pagamento</h1>
        <ol className="checkout-stepper" aria-label={siteConfig.checkout.stepperLabel}>
          {checkoutStepCards.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                className={step.active ? "is-active" : ""}
                disabled={!step.unlocked}
                aria-current={step.active ? "step" : undefined}
                onClick={() => goToStep(step.id)}
              >
                <span className="checkout-step-number" aria-hidden="true">
                  {step.complete ? "OK" : step.number}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.complete ? siteConfig.checkout.completedLabel : step.summary}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {stepError ? (
          <div className="checkout-step-error" role="alert">
            {stepError}
          </div>
        ) : null}
        <fieldset className={checkoutStepClass("contact")} data-checkout-step="contact">
          <legend>
            <span>{siteConfig.checkout.steps.contact.title}</span>
            <small>{stepSummaries.contact}</small>
          </legend>
          <div className="checkout-step-body">
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
              E-mail{" "}
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={contactValue.email}
                onChange={(event) => updateContact("email", event.target.value)}
                required
              />
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
              CPF{" "}
              <input
                name="cpf"
                placeholder="000.000.000-00"
                inputMode="numeric"
                value={contactValue.cpf}
                onChange={(event) => updateContact("cpf", event.target.value)}
                required
              />
            </label>
            <div className="checkout-step-actions">
              <button className="button primary" type="button" onClick={goToNextStep}>
                {siteConfig.checkout.nextCta}
              </button>
            </div>
          </div>
        </fieldset>
        <fieldset className={checkoutStepClass("address")} data-checkout-step="address">
          <legend>
            <span>{siteConfig.checkout.steps.address.title}</span>
            <small>{stepSummaries.address}</small>
          </legend>
          <div className="checkout-step-body">
            <div className="form-grid compact-mobile-grid cep-state-grid">
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
            <div className="form-grid compact-mobile-grid number-complement-grid">
              <label>
                Número <input name="number" autoComplete="address-line2" value={address.number} onChange={(event) => updateAddress("number", event.target.value)} required />
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
            <div className="checkout-step-subsection">
              <h2>Entrega</h2>
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
            </div>
            <div className="checkout-step-actions">
              <button className="button secondary" type="button" onClick={() => goToStep("contact")}>
                {siteConfig.checkout.backCta}
              </button>
              <button className="button primary" type="button" onClick={goToNextStep}>
                {siteConfig.checkout.nextCta}
              </button>
            </div>
          </div>
        </fieldset>
        <fieldset className={checkoutStepClass("payment")} data-checkout-step="payment">
          <legend>
            <span>{siteConfig.checkout.steps.payment.title}</span>
            <small>{stepSummaries.payment}</small>
          </legend>
          <div className="checkout-step-body">
            {checkoutPaymentMethods.map((method) => (
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
            <div className="form-error" role="alert">
              {error}
            </div>
            <div className="checkout-step-actions">
              <button className="button secondary" type="button" onClick={() => goToStep("address")}>
                {siteConfig.checkout.backCta}
              </button>
              <button className="button primary wide" type="submit" disabled={submitting || !items.length}>
                {submitting ? "Criando pedido..." : siteConfig.checkout.finalCta}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
      <aside className="summary-panel">
        <MinimumOrderNotice subtotalCents={subtotal} compact />
        <StoreTrustSignals signals={trustSignals} compact />
        <CartCompletionRecommendations
          compact
          recommendations={recommendations}
          title={
            minimumReached
              ? siteConfig.productConversion.completionReachedTitle
              : siteConfig.productConversion.completionTitle
          }
          body={
            minimumReached
              ? siteConfig.productConversion.completionReachedBody
              : siteConfig.productConversion.completionBody
          }
        />
        <WhatsAppLink href={checkoutWhatsAppHref} className="button whatsapp wide">
          {siteConfig.whatsapp.cartCta}
        </WhatsAppLink>
        <div className="summary-block">
          <h2>Resumo</h2>
            {items.map((item) => (
              <div key={cartLineKey({ slug: item.slug, skuId: item.skuId || undefined })}>
                <span>
                  {item.quantity}x {item.name}
                  {item.skuName ? ` - ${item.skuName}` : ""}
                </span>
              <strong>{money(item.lineTotalCents)}</strong>
            </div>
          ))}
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>Frete base</span>
            <strong>{shipping === 0 ? "R$ 0,00" : money(shipping)}</strong>
          </div>
          {selectedShipping ? (
            <p>
              {selectedShipping.note} {siteConfig.wholesale.nationalDeliveryNote}
            </p>
          ) : (
            <p>{siteConfig.wholesale.nationalDeliveryText} Informe o CEP para calcular o frete.</p>
          )}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
      </aside>
      <div className={mobileFieldFocused ? "mobile-checkout-bar editing" : "mobile-checkout-bar"} aria-label="Resumo rápido do checkout">
        <div>
          <span>{mobileCheckoutBarLabel}</span>
          <strong>{money(total)}</strong>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={submitting || !items.length}
          onClick={handleMobileCheckoutAction}
        >
          {submitting ? "Criando..." : mobileCheckoutActionLabel}
        </button>
      </div>
    </section>
  );
}
