export type MelhorEnvioRate = {
  serviceId: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
};

type MelhorEnvioApiRate = {
  id?: number | string;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number | string;
  custom_delivery_time?: number | string;
  delivery_range?: { min?: number | string; max?: number | string };
  custom_delivery_range?: { min?: number | string; max?: number | string };
  company?: { name?: string };
  error?: string;
};

export class MelhorEnvioError extends Error {
  constructor(
    message: string,
    public code: "NOT_CONFIGURED" | "INVALID_RESPONSE" | "REQUEST_FAILED"
  ) {
    super(message);
  }
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveDays(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.max(1, Math.ceil(parsed));
}

export function parseMelhorEnvioRates(payload: unknown): MelhorEnvioRate[] {
  if (!Array.isArray(payload)) throw new MelhorEnvioError("A Melhor Envio retornou um formato inesperado.", "INVALID_RESPONSE");

  return (payload as MelhorEnvioApiRate[])
    .filter((rate) => !rate.error && rate.id !== undefined)
    .map((rate) => {
      const price = numberOrNull(rate.custom_price ?? rate.price);
      const range = rate.custom_delivery_range || rate.delivery_range;
      const deliveryTime = positiveDays(rate.custom_delivery_time ?? rate.delivery_time);
      const deliveryMinDays = positiveDays(range?.min) ?? deliveryTime;
      const deliveryMaxDays = positiveDays(range?.max) ?? deliveryTime;

      return {
        serviceId: String(rate.id),
        serviceName: String(rate.name || "Entrega"),
        carrierName: String(rate.company?.name || "Melhor Envio"),
        priceCents: price === null ? 0 : Math.round(price * 100),
        deliveryMinDays,
        deliveryMaxDays
      } satisfies MelhorEnvioRate;
    })
    .filter((rate) => rate.priceCents > 0)
    .sort((left, right) => left.priceCents - right.priceCents);
}
