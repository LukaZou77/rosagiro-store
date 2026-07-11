import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });

  let payload: { id?: unknown; all?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const id = String(payload.id || "").trim();
  if (!payload.all && !id) return Response.json({ error: "Notificação inválida." }, { status: 400 });

  const result = await prisma.adminNotification.updateMany({
    where: payload.all ? { readAt: null } : { id, readAt: null },
    data: { readAt: new Date() }
  });
  return Response.json({ ok: true, updated: result.count }, { headers: { "Cache-Control": "no-store" } });
}
