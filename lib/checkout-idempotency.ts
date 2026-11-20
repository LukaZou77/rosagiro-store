import "server-only";

import { CheckoutAttemptError, CheckoutRejectedError, type CheckoutAttempt } from "@/lib/checkout-attempt";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/src/generated/prisma/client";

export const checkoutOrderSelect = {
  id: true, orderNumber: true, customerName: true, totalCents: true, checkoutRequestHash: true
} as const;

export async function findCheckoutOrder(attempt: CheckoutAttempt) {
  const decision = await prisma.checkoutAttempt.findUnique({ where: { id: attempt.id } });
  if (decision) {
    checkIdentity(decision.requestHash, attempt);
    if (decision.status === "REJECTED") throw new CheckoutRejectedError(decision.error || "Revise o pedido.", decision.statusCode || 400);
  }
  const order = await prisma.order.findUnique({
    where: { checkoutAttemptId: attempt.id }, select: checkoutOrderSelect
  });
  if (order) checkIdentity(order.checkoutRequestHash, attempt);
  return order;
}

function checkIdentity(hash: string | null, attempt: CheckoutAttempt) {
  if (hash !== attempt.requestHash) throw new CheckoutAttemptError("Esta tentativa já pertence a outro pedido. Verifique o pedido anterior antes de continuar.");
}

type SavedCheckoutOrder = Prisma.OrderGetPayload<{ select: typeof checkoutOrderSelect }>;

export async function runCheckoutCreation(
  attempt: CheckoutAttempt,
  create: (tx: Prisma.TransactionClient) => Promise<SavedCheckoutOrder>,
  rejection: (error: unknown) => { message: string; status: number } | null
) {
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "CheckoutAttempt" ("id", "requestHash", "updatedAt")
      VALUES (${attempt.id}, ${attempt.requestHash}, NOW()) ON CONFLICT ("id") DO NOTHING`;
    await tx.$queryRaw`SELECT "id" FROM "CheckoutAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`;
    const decision = await tx.checkoutAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    checkIdentity(decision.requestHash, attempt);
    if (decision.status === "REJECTED") return { rejection: { message: decision.error || "Revise o pedido.", status: decision.statusCode || 400 } };
    const existing = await tx.order.findUnique({ where: { checkoutAttemptId: attempt.id }, select: checkoutOrderSelect });
    if (existing) {
      checkIdentity(existing.checkoutRequestHash, attempt);
      return { order: existing, created: false };
    }
    let order: SavedCheckoutOrder;
    try { order = await create(tx); }
    catch (error) {
      const rejected = rejection(error);
      if (!rejected) throw error;
      await tx.checkoutAttempt.update({ where: { id: attempt.id }, data: { status: "REJECTED", error: rejected.message, statusCode: rejected.status } });
      return { rejection: rejected };
    }
    await tx.checkoutAttempt.update({ where: { id: attempt.id }, data: { status: "CREATED" } });
    return { order, created: true };
  }, { maxWait: 15_000, timeout: 25_000 });
  if (outcome.rejection) throw new CheckoutRejectedError(outcome.rejection.message, outcome.rejection.status);
  return { order: outcome.order!, created: outcome.created! };
}
