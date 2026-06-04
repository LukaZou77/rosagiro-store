import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { parseAnjunD2DPickupWorkbook } from "@/lib/shipping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo XLSX." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "A importação de frete aceita somente .xlsx." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const preview = await parseAnjunD2DPickupWorkbook(buffer, file.name);
  return NextResponse.json(preview);
}
