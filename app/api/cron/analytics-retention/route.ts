import { deleteExpiredSiteAnalytics } from "@/lib/site-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const result = await deleteExpiredSiteAnalytics();
  return Response.json(
    { ok: true, deleted: result.count },
    { headers: { "Cache-Control": "no-store" } }
  );
}
