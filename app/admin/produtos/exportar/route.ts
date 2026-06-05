import { getAdmin } from "@/lib/auth";
import { currentProductsCsv } from "@/lib/product-export";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });

  return new Response(await currentProductsCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rosagiro-produtos-export.csv"'
    }
  });
}
