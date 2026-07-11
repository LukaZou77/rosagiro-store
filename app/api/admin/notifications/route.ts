import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });

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
