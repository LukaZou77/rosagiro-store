import { Buffer } from "node:buffer";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { importAnjunD2DPickupRates } from "@/lib/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo XLSX." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "A importacao de frete aceita somente .xlsx." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importAnjunD2DPickupRates(buffer, file.name);
    revalidatePath("/admin/frete");
    revalidatePath("/checkout");
    revalidatePath("/carrinho");
    revalidatePath("/entrega");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel importar a tabela de frete.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
