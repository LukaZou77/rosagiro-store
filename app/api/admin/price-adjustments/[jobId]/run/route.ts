import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { processPriceAdjustmentJobChunk } from "@/lib/product-price-adjustment-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

function revalidatePriceAdjustmentSurfaces() {
  revalidatePath("/");
  revalidatePath("/categoria/all");
  revalidatePath("/promocoes");
  revalidatePath("/carrinho");
  revalidatePath("/checkout");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/produtos/qualidade");
}

export async function POST(_request: Request, context: RouteContext) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await context.params;
  const job = await processPriceAdjustmentJobChunk(jobId);
  if (!job) return NextResponse.json({ error: "Ajuste não encontrado." }, { status: 404 });

  if (job.status === "COMPLETED") {
    revalidatePriceAdjustmentSurfaces();
  }

  return NextResponse.json({ job });
}
