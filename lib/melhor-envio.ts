import "server-only";

import { cepDigits } from "@/lib/cep";
import { MelhorEnvioError, parseMelhorEnvioRates } from "@/lib/melhor-envio-rates";

export { MelhorEnvioError, parseMelhorEnvioRates } from "@/lib/melhor-envio-rates";
export type { MelhorEnvioRate } from "@/lib/melhor-envio-rates";

const productionBaseUrl = "https://melhorenvio.com.br";
const sandboxBaseUrl = "https://sandbox.melhorenvio.com.br";

export type MelhorEnvioProduct = {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
};

export function getMelhorEnvioConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  const environment = env.MELHOR_ENVIO_ENVIRONMENT === "production" ? "production" : "sandbox";
  const baseUrl = (env.MELHOR_ENVIO_BASE_URL || (environment === "production" ? productionBaseUrl : sandboxBaseUrl)).replace(/\/$/, "");
  const originCep = cepDigits(env.MELHOR_ENVIO_ORIGIN_CEP || "03032-020");
  const userAgent = (env.MELHOR_ENVIO_USER_AGENT || "RosaGiro (rosagiroatacado@gmail.com)").trim();
  const tokenConfigured = Boolean(env.MELHOR_ENVIO_TOKEN?.trim());
  const originConfigured = originCep.length === 8;
  const userAgentConfigured = /\S+\s*\([^()\s]+@[^()\s]+\)/.test(userAgent);

  return {
    configured: tokenConfigured && originConfigured && userAgentConfigured,
    tokenConfigured,
    originConfigured,
    userAgentConfigured,
    environment,
    baseUrl,
    originCep,
    userAgent
  } as const;
}

export async function calculateMelhorEnvioRates({
  destinationCep,
  products
}: {
  destinationCep: string;
  products: MelhorEnvioProduct[];
}) {
  const config = getMelhorEnvioConfigStatus();
  if (!config.configured) {
    throw new MelhorEnvioError("A cotação online ainda não foi configurada.", "NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${config.baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN?.trim()}`,
        "Content-Type": "application/json",
        "User-Agent": config.userAgent
      },
      body: JSON.stringify({
        from: { postal_code: config.originCep },
        to: { postal_code: cepDigits(destinationCep) },
        products,
        options: { receipt: false, own_hand: false }
      }),
      cache: "no-store",
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const apiMessage =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message || "")
          : "";
      throw new MelhorEnvioError(
        apiMessage || `A Melhor Envio recusou a cotação (${response.status}).`,
        "REQUEST_FAILED"
      );
    }

    return parseMelhorEnvioRates(payload);
  } catch (error) {
    if (error instanceof MelhorEnvioError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MelhorEnvioError("A Melhor Envio demorou para responder. Tente novamente.", "REQUEST_FAILED");
    }
    throw new MelhorEnvioError("Não foi possível consultar a Melhor Envio agora.", "REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
