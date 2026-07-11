"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpenText,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FolderTree,
  Gauge,
  Import,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Users,
  X
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: number;
  external?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  const pathOnly = href.split("?")[0];
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

export function AdminShellClient({
  children,
  adminName,
  outOfStockCount
}: {
  children: React.ReactNode;
  adminName: string;
  outOfStockCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = useMemo<NavGroup[]>(
    () => [
      {
        label: "Visão geral",
        items: [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/analytics", label: "Análises de produtos", icon: BarChart3 }
        ]
      },
      {
        label: "Operação",
        items: [
          { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
          { href: "/admin/produtos", label: "Produtos", icon: Boxes },
          { href: "/admin/produtos?stock=out", label: "Sem estoque", icon: PackageSearch, badge: outOfStockCount },
          { href: "/admin/clientes", label: "Clientes", icon: Users },
          { href: "/admin/frete", label: "Frete", icon: Truck },
          { href: "/admin/pagamentos", label: "Pagamentos", icon: CircleDollarSign }
        ]
      },
      {
        label: "Catálogo",
        items: [
          { href: "/admin/marcas", label: "Marcas", icon: Tags },
          { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
          { href: "/admin/produtos/qualidade", label: "Qualidade", icon: ClipboardCheck },
          { href: "/admin/importar-produtos", label: "Importar e exportar", icon: Import },
          { href: "/admin/produtos/lixeira", label: "Lixeira", icon: ShieldCheck }
        ]
      },
      {
        label: "Conteúdo e loja",
        items: [
          { href: "/admin/loja", label: "Dados da loja", icon: Building2 },
          { href: "/admin/politicas", label: "Políticas", icon: BookOpenText },
          { href: "/admin/guias", label: "Guias e artigos", icon: Store },
          { href: "/admin/prontidao", label: "Prontidão", icon: Gauge },
          { href: "/", label: "Abrir loja", icon: Store, external: true }
        ]
      }
    ],
    [outOfStockCount]
  );

  const currentItem = groups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <main className={`admin-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      <button
        className="admin-mobile-backdrop"
        type="button"
        aria-label="Fechar navegação"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="admin-app-sidebar" aria-label="Navegação administrativa">
        <div className="admin-sidebar-brand-row">
          <Link className="admin-sidebar-brand" href="/admin" aria-label="RosaGiro Admin">
            <span className="admin-sidebar-logo">RG</span>
            <span className="admin-sidebar-brand-copy">
              <strong>RosaGiro</strong>
              <small>Operações</small>
            </span>
          </Link>
          <button
            className="admin-icon-button admin-mobile-close"
            type="button"
            aria-label="Fechar menu"
            title="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-primary-nav">
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    className={`admin-nav-link${active ? " is-active" : ""}`}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    onClick={() => setMobileOpen(false)}
                    key={item.href}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {item.badge ? <small>{item.badge}</small> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            className="admin-collapse-button"
            type="button"
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span>{collapsed ? "Expandir" : "Recolher menu"}</span>
          </button>
        </div>
      </aside>

      <section className="admin-app-main">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button
              className="admin-icon-button admin-menu-button"
              type="button"
              aria-label="Abrir menu"
              title="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="admin-breadcrumb">
              <span>Admin</span>
              <ChevronRight size={14} />
              <strong>{currentItem?.label || "Operações"}</strong>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <Link className="admin-search-trigger" href="/admin/produtos">
              <Search size={17} />
              <span>Buscar no admin</span>
            </Link>
            <button className="admin-icon-button" type="button" aria-label="Notificações" title="Notificações">
              <Bell size={19} />
            </button>
            <div className="admin-user-menu">
              <span className="admin-user-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
              <span className="admin-user-copy">
                <strong>{adminName}</strong>
                <small>Administrador</small>
              </span>
              <form action={logoutAction}>
                <button className="admin-icon-button" type="submit" aria-label="Sair" title="Sair">
                  <LogOut size={17} />
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="admin-page-content">{children}</div>
      </section>
    </main>
  );
}
