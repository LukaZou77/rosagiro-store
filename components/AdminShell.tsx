import { AdminShellClient } from "@/components/AdminShellClient";
import { prisma } from "@/lib/db";

export async function AdminShell({
  children,
  adminName
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  const outOfStockCount = await prisma.product.count({
    where: {
      active: true,
      deletedAt: null,
      OR: [{ inventory: null }, { inventory: { quantity: 0 } }]
    }
  });

  return (
    <AdminShellClient adminName={adminName} outOfStockCount={outOfStockCount}>
      {children}
    </AdminShellClient>
  );
}
