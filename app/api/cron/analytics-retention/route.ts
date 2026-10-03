import { deleteExpiredSiteAnalytics } from "@/lib/site-analytics";
import { runAnalyticsRollup } from "@/lib/analytics-rollup";
import { deleteExpiredAdminLoginRateLimitBuckets } from "@/lib/admin-login-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const rollup = await runAnalyticsRollup();
  const deleted = await deleteExpiredSiteAnalytics();
  const deletedAdminLoginRateLimitBuckets = await deleteExpiredAdminLoginRateLimitBuckets();
  return Response.json(
    { ok: true, rollup, deleted, deletedAdminLoginRateLimitBuckets },
    { headers: { "Cache-Control": "no-store" } }
  );
}
