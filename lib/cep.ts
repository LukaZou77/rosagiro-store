export type CepLookupResult =
  | {
      status: "found";
      address: {
        street: string;
        district: string;
        city: string;
        state: string;
      };
    }
  | { status: "not-found" };

export type ViaCepAddress = {
  cep: string;
  street: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export type ViaCepSearchResult =
  | { status: "found"; addresses: ViaCepAddress[] }
  | { status: "empty"; message: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function cepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCep(value: string) {
  const digits = cepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanUf(value: string) {
  return cleanText(value).replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
}

function viaCepAddressFromResponse(data: ViaCepResponse): ViaCepAddress {
  return {
    cep: formatCep(data.cep || ""),
    street: cleanText(data.logradouro),
    complement: cleanText(data.complemento),
    district: cleanText(data.bairro),
    city: cleanText(data.localidade),
    state: cleanUf(data.uf || "")
  };
}

export function makeViaCepPlaceId(cep: string) {
  const digits = cepDigits(cep);
  return digits.length === 8 ? `viacep:${digits}` : "";
}

export function viaCepDigitsFromPlaceId(placeId: string) {
  if (!placeId.startsWith("viacep:")) return "";
  return cepDigits(placeId.slice("viacep:".length));
}

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookupResult> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return { status: "not-found" };

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) throw new Error("CEP lookup failed.");

  const data = (await response.json()) as ViaCepResponse;
  if (data.erro) return { status: "not-found" };

  const address = viaCepAddressFromResponse(data);

  return {
    status: "found",
    address: {
      street: address.street,
      district: address.district,
      city: address.city,
      state: address.state
    }
  };
}

export async function searchViaCepAddress({
  state,
  city,
  street,
  signal
}: {
  state: string;
  city: string;
  street: string;
  signal?: AbortSignal;
}): Promise<ViaCepSearchResult> {
  const uf = cleanUf(state);
  const cleanCity = cleanText(city).slice(0, 80);
  const cleanStreet = cleanText(street).slice(0, 120);

  if (cleanStreet.length < 3) {
    return {
      status: "invalid",
      message: "Digite pelo menos 3 caracteres para buscar sugestões."
    };
  }

  if (uf.length !== 2 || cleanCity.length < 3) {
    return {
      status: "invalid",
      message: "Informe UF e cidade para buscar por rua."
    };
  }

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(cleanStreet)}/json/`,
      { signal }
    );

    if (response.status === 400) {
      return {
        status: "invalid",
        message: "Informe UF, cidade e rua com pelo menos 3 caracteres."
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: "Não foi possível consultar o ViaCEP agora. Preencha manualmente."
      };
    }

    const data = (await response.json()) as ViaCepResponse[] | { erro?: boolean };
    if (!Array.isArray(data) || !data.length) {
      return {
        status: "empty",
        message: "Nenhum endereço encontrado. Você pode preencher manualmente."
      };
    }

    const seen = new Set<string>();
    const addresses = data
      .map(viaCepAddressFromResponse)
      .filter((address) => {
        const digits = cepDigits(address.cep);
        if (digits.length !== 8 || seen.has(digits)) return false;
        seen.add(digits);
        return Boolean(address.street && address.city && address.state);
      })
      .slice(0, 10);

    if (!addresses.length) {
      return {
        status: "empty",
        message: "Nenhum endereço encontrado. Você pode preencher manualmente."
      };
    }

    return { status: "found", addresses };
  } catch {
    return {
      status: "error",
      message: "Não foi possível consultar o ViaCEP agora. Preencha manualmente."
    };
  }
}
