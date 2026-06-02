import "server-only";

import {
  type CustomerSessionIntent,
  type CustomerSessionSummary,
  CustomerSessionError,
  cleanCustomerName,
  formatBrazilWhatsapp,
  normalizeBrazilWhatsapp,
  onlyDigits,
  parseCustomerSessionPayload
} from "@/lib/customer-session";
import { prisma } from "@/lib/db";

export {
  type CustomerSessionIntent,
  type CustomerSessionSummary,
  CustomerSessionError,
  cleanCustomerName,
  formatBrazilWhatsapp,
  normalizeBrazilWhatsapp,
  onlyDigits,
  parseCustomerSessionPayload
};

export async function upsertCustomerSession(input: {
  name: string;
  whatsapp: string;
  whatsappDigits: string;
  intent?: CustomerSessionIntent;
}): Promise<CustomerSessionSummary> {
  const now = new Date();
  const customer = await prisma.customer.upsert({
    where: { whatsappDigits: input.whatsappDigits },
    update: {
      name: input.name,
      whatsapp: input.whatsapp,
      loginCount: { increment: 1 },
      lastLoginAt: now,
      lastSeenAt: now
    },
    create: {
      name: input.name,
      whatsapp: input.whatsapp,
      whatsappDigits: input.whatsappDigits,
      loginCount: 1,
      lastLoginAt: now,
      lastSeenAt: now
    },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      whatsappDigits: true
    }
  });

  return customer;
}

export async function upsertCustomerFromContact(name: string, whatsapp: string) {
  const parsed = parseCustomerSessionPayload({ name, whatsapp, intent: "checkout" });
  const now = new Date();
  return prisma.customer.upsert({
    where: { whatsappDigits: parsed.whatsappDigits },
    update: {
      name: parsed.name,
      whatsapp: parsed.whatsapp,
      lastSeenAt: now
    },
    create: {
      name: parsed.name,
      whatsapp: parsed.whatsapp,
      whatsappDigits: parsed.whatsappDigits,
      lastSeenAt: now
    },
    select: {
      id: true,
      name: true,
      whatsapp: true,
      whatsappDigits: true
    }
  });
}
