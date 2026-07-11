import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) return response({ error: "Não autorizado." }, 401);

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  if (query.length < 2) return response({ products: [], orders: [], customers: [] });

  const [products, orders, customers] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { mpn: { contains: query, mode: "insensitive" } },
          { gtin: { contains: query, mode: "insensitive" } },
          { skus: { some: { code: { contains: query, mode: "insensitive" } } } }
        ]
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, slug: true, name: true, image: true, active: true, brand: { select: { name: true } } }
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query, mode: "insensitive" } },
          { customerEmail: { contains: query, mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, status: true, totalCents: true }
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { whatsapp: { contains: query, mode: "insensitive" } },
          { whatsappDigits: { contains: query, mode: "insensitive" } }
        ]
      },
      orderBy: { lastSeenAt: "desc" },
      take: 5,
      select: { id: true, name: true, whatsapp: true, _count: { select: { orders: true } } }
    })
  ]);

  return response({ products, orders, customers });
}
