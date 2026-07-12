import { createHash } from "node:crypto";

export function whatsAppLeadDedupeKey(whatsappDigits: string, occurredAt: Date) {
  const minute = occurredAt.toISOString().slice(0, 16);
  return createHash("sha256").update(`${whatsappDigits}:${minute}`).digest("hex");
}
