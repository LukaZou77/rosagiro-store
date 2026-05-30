import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";

export function AdminShell({
  children,
  adminName
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">BV</span>
          <span>
            <strong>Bela Viva</strong>
            <small>admin</small>
          </span>
        </Link>
        <nav>
          <Link href="/admin">Resumo</Link>
          <Link href="/admin/produtos">Produtos</Link>
          <Link href="/admin/importar-produtos">Importar CSV</Link>
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/">Ver loja</Link>
        </nav>
        <form action={logoutAction}>
          <button type="submit">Sair de {adminName}</button>
        </form>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
