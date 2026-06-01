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

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
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

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookupResult> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return { status: "not-found" };

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) throw new Error("CEP lookup failed.");

  const data = (await response.json()) as ViaCepResponse;
  if (data.erro) return { status: "not-found" };

  return {
    status: "found",
    address: {
      street: data.logradouro || "",
      district: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || ""
    }
  };
}
