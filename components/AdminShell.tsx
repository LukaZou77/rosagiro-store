import { AdminShellClient } from "@/components/AdminShellClient";
import { prisma } from "@/lib/db";

export async function AdminShell({
  children,
  adminName
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  const [outOfStockCount, notifications, unreadNotificationCount] = await Promise.all([
    prisma.product.count({
      where: {
        active: true,
        deletedAt: null,
        OR: [{ inventory: null }, { inventory: { quantity: 0 } }]
      }
    }),
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

  return (
    <AdminShellClient
      adminName={adminName}
      outOfStockCount={outOfStockCount}
      initialUnreadNotificationCount={unreadNotificationCount}
      initialNotifications={notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt?.toISOString() || null,
        createdAt: notification.createdAt.toISOString()
      }))}
    >
      {children}
    </AdminShellClient>
  );
}
