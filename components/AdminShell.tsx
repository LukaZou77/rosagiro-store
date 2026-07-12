import { AdminShellClient } from "@/components/AdminShellClient";
import { prisma } from "@/lib/db";

export async function AdminShell({
  children,
  adminName
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  const [outOfStockResult, unreadResult] = await Promise.allSettled([
    prisma.product.count({
      where: {
        active: true,
        deletedAt: null,
        OR: [{ inventory: null }, { inventory: { quantity: 0 } }]
      }
    }),
    prisma.adminNotification.count({ where: { readAt: null } })
  ]);
  const outOfStockCount = outOfStockResult.status === "fulfilled" ? outOfStockResult.value : 0;
  const unreadNotificationCount = unreadResult.status === "fulfilled" ? unreadResult.value : 0;

  return (
    <AdminShellClient
      adminName={adminName}
      outOfStockCount={outOfStockCount}
      initialUnreadNotificationCount={unreadNotificationCount}
      initialNotifications={[]}
    >
      {children}
    </AdminShellClient>
  );
}
