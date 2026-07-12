import { recordWhatsAppClick } from "@/lib/whatsapp-analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await recordWhatsAppClick(payload as Record<string, unknown>, request.headers);
    if (!result.ok) return Response.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return Response.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
