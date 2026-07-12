import { getAdminBusinessAnalytics } from "@/lib/admin-business-analytics";
import { getAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  try {
    const data = await getAdminBusinessAnalytics(url.searchParams.get("period"), url.searchParams.get("compare"));
    return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
