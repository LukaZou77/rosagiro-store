import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { getPriceAdjustmentJob } from "@/lib/product-price-adjustment-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await context.params;
  const job = await getPriceAdjustmentJob(jobId);
  if (!job) return NextResponse.json({ error: "Ajuste não encontrado." }, { status: 404 });

  return NextResponse.json({ job });
}
