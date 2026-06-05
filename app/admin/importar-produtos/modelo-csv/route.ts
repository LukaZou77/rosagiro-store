import { getAdmin } from "@/lib/auth";
import { productImportTemplateCsv } from "@/lib/product-import-shared";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });

  return new Response(productImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rosagiro-produtos-template.csv"'
    }
  });
}
