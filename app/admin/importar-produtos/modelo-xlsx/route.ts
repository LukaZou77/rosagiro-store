import { getAdmin } from "@/lib/auth";
import { createProductTemplateXlsx } from "@/lib/xlsx-template";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });

  return new Response(createProductTemplateXlsx(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="rosagiro-produtos-template.xlsx"'
    }
  });
}
