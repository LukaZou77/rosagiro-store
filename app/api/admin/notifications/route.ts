import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const summaryOnly = new URL(request.url).searchParams.get("summary") === "1";
  if (summaryOnly) {
    const unreadCount = await prisma.adminNotification.count({ where: { readAt: null } });
    return Response.json(
      { unreadCount },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        notificationType: true,
        title: true,
        message: true,
        actionHref: true,
        readAt: true,
        whatsappStatus: true,
        createdAt: true
      }
    }),
    prisma.adminNotification.count({ where: { readAt: null } })
  ]);

  return Response.json(
    {
      unreadCount,
      notifications: notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt?.toISOString() || null,
        createdAt: notification.createdAt.toISOString()
      }))
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
