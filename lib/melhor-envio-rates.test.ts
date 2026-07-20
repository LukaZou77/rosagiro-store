import assert from "node:assert/strict";
import test from "node:test";
import { MelhorEnvioError, parseMelhorEnvioRates } from "./melhor-envio-rates";

test("prefers customized Melhor Envio price and delivery range", () => {
  const rates = parseMelhorEnvioRates([
    {
      id: 1,
      name: "PAC",
      price: "190.00",
      custom_price: "168.61",
      delivery_time: 10,
      custom_delivery_range: { min: 7, max: 9 },
      company: { name: "Correios" }
    }
  ]);

  assert.deepEqual(rates, [
    {
      serviceId: "1",
      serviceName: "PAC",
      carrierName: "Correios",
      priceCents: 16861,
      deliveryMinDays: 7,
      deliveryMaxDays: 9
    }
  ]);
});

test("drops carrier errors and zero-priced responses, then sorts by price", () => {
  const rates = parseMelhorEnvioRates([
    { id: 2, name: "SEDEX", custom_price: "292.37", custom_delivery_time: 3, company: { name: "Correios" } },
    { id: 99, error: "Serviço indisponível" },
    { id: 1, name: "PAC", custom_price: "168.61", custom_delivery_time: 7, company: { name: "Correios" } },
    { id: 3, name: "Sem preço", custom_price: "0" }
  ]);

  assert.deepEqual(rates.map((rate) => rate.serviceId), ["1", "2"]);
});

test("rejects unexpected API payloads", () => {
  assert.throws(
    () => parseMelhorEnvioRates({ message: "invalid" }),
    (error: unknown) => error instanceof MelhorEnvioError && error.code === "INVALID_RESPONSE"
  );
});
