import "server-only";

import { lookupCep, makeViaCepPlaceId, searchViaCepAddress, viaCepDigitsFromPlaceId } from "@/lib/cep";

export type AddressSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
};

export type AddressLookupStatus = "OK" | "DISABLED" | "ERROR";

export type AddressAutocompleteResult = {
  status: AddressLookupStatus;
  suggestions: AddressSuggestion[];
  message?: string;
};

export type AddressDetailsResult = {
  status: AddressLookupStatus;
  placeId?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  address?: {
    cep?: string;
    state?: string;
    city?: string;
    district?: string;
    street?: string;
    number?: string;
  };
  message?: string;
};

export type CheckoutAddressForValidation = {
  cep: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement?: string;
};

export type AddressMatchStatus = "VALIDATED" | "NEEDS_REVIEW" | "FAILED" | "DISABLED";

export type AddressMatchSnapshot = {
  status: AddressMatchStatus;
  provider: string | null;
  formattedAddress: string | null;
  placeId: string | null;
  granularity: string | null;
  latitude: number | null;
  longitude: number | null;
  message: string | null;
  checkedAt: Date;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type GoogleAddressValidationResponse = {
  result?: {
    verdict?: {
      validationGranularity?: string;
      geocodeGranularity?: string;
      addressComplete?: boolean;
      hasUnconfirmedComponents?: boolean;
      hasInferredComponents?: boolean;
      hasReplacedComponents?: boolean;
    };
    address?: {
      formattedAddress?: string;
    };
    geocode?: {
      placeId?: string;
      location?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
};

const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";
const ADDRESS_VALIDATION_URL = "https://addressvalidation.googleapis.com/v1:validateAddress";
const REQUEST_TIMEOUT_MS = 7000;

const usableGranularities = new Set(["SUB_PREMISE", "PREMISE", "PREMISE_PROXIMITY", "ROUTE", "BLOCK"]);

function googleApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
}

export function hasGoogleAddressApiKey() {
  return Boolean(googleApiKey());
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function fetchJson<T>(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function componentValue(components: GoogleAddressComponent[] | undefined, types: string[], short = false) {
  const component = components?.find((item) => types.some((type) => item.types?.includes(type)));
  return cleanText(short ? component?.shortText || component?.longText : component?.longText || component?.shortText);
}

function mapAddressComponents(components: GoogleAddressComponent[] | undefined) {
  return {
    cep: componentValue(components, ["postal_code"], true),
    state: componentValue(components, ["administrative_area_level_1"], true).toUpperCase(),
    city: componentValue(components, ["locality", "administrative_area_level_2"]),
    district: componentValue(components, ["sublocality_level_1", "sublocality", "neighborhood"]),
    street: componentValue(components, ["route"]),
    number: componentValue(components, ["street_number"], true)
  };
}

function disabledAutocomplete(): AddressAutocompleteResult {
  return {
    status: "DISABLED",
    suggestions: [],
    message: "Busca por endereço indisponível agora. Use o CEP ou preencha manualmente."
  };
}

function disabledDetails(): AddressDetailsResult {
  return {
    status: "DISABLED",
    message: "Busca por endereço indisponível agora. Use o CEP ou preencha manualmente."
  };
}

export async function autocompleteViaCepAddress({
  input,
  state,
  city
}: {
  input: string;
  state?: string;
  city?: string;
}): Promise<AddressAutocompleteResult> {
  try {
    const result = await searchViaCepAddress({
      state: state || "",
      city: city || "",
      street: input
    });

    if (result.status === "invalid") {
      return {
        status: "DISABLED",
        suggestions: [],
        message: result.message
      };
    }

    if (result.status === "empty") {
      return {
        status: "OK",
        suggestions: [],
        message: result.message
      };
    }

    if (result.status === "error") {
      return {
        status: "ERROR",
        suggestions: [],
        message: result.message
      };
    }

    return {
      status: "OK",
      message: "Selecione um endereço ViaCEP para preencher os dados.",
      suggestions: result.addresses.map((address) => ({
        placeId: makeViaCepPlaceId(address.cep),
        mainText: address.street || `CEP ${address.cep}`,
        secondaryText: [address.district, `${address.city} - ${address.state}`, `CEP ${address.cep}`].filter(Boolean).join(" / "),
        fullText: [address.street, address.district, `${address.city} - ${address.state}`, `CEP ${address.cep}`].filter(Boolean).join(", "),
        types: ["viacep"]
      }))
    };
  } catch {
    return {
      status: "ERROR",
      suggestions: [],
      message: "Não foi possível consultar o ViaCEP agora. Preencha manualmente."
    };
  }
}

export async function getViaCepPlaceDetails(placeId: string): Promise<AddressDetailsResult | null> {
  const digits = viaCepDigitsFromPlaceId(placeId);
  if (!digits) return null;

  try {
    const result = await lookupCep(digits);
    if (result.status !== "found") {
      return {
        status: "ERROR",
        message: "Não foi possível carregar o endereço ViaCEP selecionado. Preencha manualmente."
      };
    }

    const formattedCep = `${digits.slice(0, 5)}-${digits.slice(5)}`;

    return {
      status: "OK",
      placeId,
      formattedAddress: `${result.address.street}, ${result.address.district}, ${result.address.city} - ${result.address.state}, CEP ${formattedCep}`,
      address: {
        cep: formattedCep,
        state: result.address.state,
        city: result.address.city,
        district: result.address.district,
        street: result.address.street
      }
    };
  } catch {
    return {
      status: "ERROR",
      message: "Não foi possível carregar o endereço ViaCEP selecionado. Preencha manualmente."
    };
  }
}

export async function autocompleteAddress(input: string, sessionToken?: string): Promise<AddressAutocompleteResult> {
  const apiKey = googleApiKey();
  const query = cleanText(input).slice(0, 160);

  if (query.length < 3) {
    return { status: "OK", suggestions: [] };
  }

  if (!apiKey) {
    return disabledAutocomplete();
  }

  const data = await fetchJson<GoogleAutocompleteResponse>(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.types"
    },
    body: JSON.stringify({
      input: query,
      languageCode: "pt-BR",
      regionCode: "BR",
      includedRegionCodes: ["br"],
      sessionToken: cleanText(sessionToken) || undefined
    })
  });

  if (!data) {
    return {
      status: "ERROR",
      suggestions: [],
      message: "Não foi possível buscar sugestões agora. Preencha manualmente."
    };
  }

  const suggestions =
    data.suggestions
      ?.map((suggestion) => {
        const prediction = suggestion.placePrediction;
        const placeId = cleanText(prediction?.placeId);
        const fullText = cleanText(prediction?.text?.text);
        const mainText = cleanText(prediction?.structuredFormat?.mainText?.text) || fullText;
        const secondaryText = cleanText(prediction?.structuredFormat?.secondaryText?.text);

        if (!placeId || !fullText) return null;

        return {
          placeId,
          mainText,
          secondaryText,
          fullText,
          types: prediction?.types || []
        };
      })
      .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion))
      .slice(0, 6) || [];

  return { status: "OK", suggestions };
}

export async function getAddressPlaceDetails(placeId: string, sessionToken?: string): Promise<AddressDetailsResult> {
  const apiKey = googleApiKey();
  const cleanPlaceId = cleanText(placeId).slice(0, 256);

  if (!cleanPlaceId) {
    return { status: "ERROR", message: "Selecione um endereço válido." };
  }

  if (!apiKey) {
    return disabledDetails();
  }

  const params = new URLSearchParams({
    languageCode: "pt-BR",
    regionCode: "BR"
  });
  const cleanSessionToken = cleanText(sessionToken);
  if (cleanSessionToken) params.set("sessionToken", cleanSessionToken);

  const data = await fetchJson<GooglePlaceDetailsResponse>(`${PLACES_DETAILS_URL}/${encodeURIComponent(cleanPlaceId)}?${params.toString()}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,shortFormattedAddress,addressComponents,location"
    }
  });

  if (!data) {
    return {
      status: "ERROR",
      message: "Não foi possível carregar o endereço selecionado. Preencha manualmente."
    };
  }

  return {
    status: "OK",
    placeId: data.id || cleanPlaceId,
    formattedAddress: data.formattedAddress || data.shortFormattedAddress || undefined,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
    address: mapAddressComponents(data.addressComponents)
  };
}

export async function validateCheckoutAddress(address: CheckoutAddressForValidation): Promise<AddressMatchSnapshot> {
  const checkedAt = new Date();
  const apiKey = googleApiKey();

  if (!hasGoogleAddressApiKey()) {
    return {
      status: "DISABLED",
      provider: null,
      formattedAddress: null,
      placeId: null,
      granularity: null,
      latitude: null,
      longitude: null,
      message: "Google Maps API key não configurada; endereço salvo sem validação externa.",
      checkedAt
    };
  }

  const cep = digits(address.cep);
  const lineOne = [address.street, address.number].map(cleanText).filter(Boolean).join(", ");
  const lineTwo = [address.complement, address.district].map(cleanText).filter(Boolean).join(" - ");
  const addressLines = [lineOne, lineTwo].filter(Boolean);

  const params = new URLSearchParams({ key: apiKey });
  const data = await fetchJson<GoogleAddressValidationResponse>(`${ADDRESS_VALIDATION_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      address: {
        regionCode: "BR",
        languageCode: "pt-BR",
        postalCode: cep,
        administrativeArea: cleanText(address.state).toUpperCase(),
        locality: cleanText(address.city),
        addressLines
      }
    })
  });

  if (!data?.result) {
    return {
      status: "FAILED",
      provider: "GOOGLE_ADDRESS_VALIDATION",
      formattedAddress: null,
      placeId: null,
      granularity: null,
      latitude: null,
      longitude: null,
      message: "Não foi possível validar o endereço agora; pedido salvo para conferência manual.",
      checkedAt
    };
  }

  const verdict = data.result.verdict;
  const granularity = verdict?.validationGranularity || verdict?.geocodeGranularity || null;
  const needsReview =
    !verdict?.addressComplete ||
    verdict?.hasUnconfirmedComponents ||
    verdict?.hasInferredComponents ||
    verdict?.hasReplacedComponents ||
    !granularity ||
    !usableGranularities.has(granularity);

  return {
    status: needsReview ? "NEEDS_REVIEW" : "VALIDATED",
    provider: "GOOGLE_ADDRESS_VALIDATION",
    formattedAddress: data.result.address?.formattedAddress || null,
    placeId: data.result.geocode?.placeId || null,
    granularity,
    latitude: data.result.geocode?.location?.latitude ?? null,
    longitude: data.result.geocode?.location?.longitude ?? null,
    message: needsReview
      ? "Endereço salvo com alerta para conferência manual."
      : "Endereço validado pela base do Google Maps.",
    checkedAt
  };
}
