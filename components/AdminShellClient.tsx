"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  UserRound,
  X
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { AdminSectionNav, getAdminPageLabel, type AdminModuleKey } from "@/components/AdminSectionNav";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  moduleKey: AdminModuleKey;
  matchPaths: string[];
  exact?: boolean;
  badge?: number;
};

export type AdminNotificationItem = {
  id: string;
  notificationType: "NEW_ORDER" | "ORDER_PAID";
  title: string;
  message: string;
  actionHref: string;
  readAt: string | null;
  whatsappStatus: "NOT_CONFIGURED" | "PENDING" | "SENT" | "FAILED";
  createdAt: string;
};

type SearchResults = {
  products: Array<{ id: string; slug: string; name: string; image: string; active: boolean; brand: { name: string } }>;
  orders: Array<{ id: string; orderNumber: string; customerName: string; customerPhone: string; status: string; totalCents: number }>;
  customers: Array<{ id: string; name: string; whatsapp: string; _count: { orders: number } }>;
};

const emptySearchResults: SearchResults = { products: [], orders: [], customers: [] };
const notificationTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

function isActivePath(pathname: string, item: NavItem) {
  return item.matchPaths.some((path) => pathname === path || (!item.exact && pathname.startsWith(`${path}/`)));
}

function compactMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminShellClient({
  children,
  adminName,
  outOfStockCount,
  initialNotifications,
  initialUnreadNotificationCount
}: {
  children: React.ReactNode;
  adminName: string;
  outOfStockCount: number;
  initialNotifications: AdminNotificationItem[];
  initialUnreadNotificationCount: number;
}) {
  const pathname = usePathname();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const searchDialogRef = useRef<HTMLElement | null>(null);
  const notificationDrawerRef = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults>(emptySearchResults);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadNotificationCount);

  const mainItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/admin",
        label: "Visão geral",
        icon: LayoutDashboard,
        moduleKey: "overview",
        matchPaths: ["/admin"],
        exact: true
      },
      {
        href: "/admin/pedidos",
        label: "Vendas",
        icon: ShoppingBag,
        moduleKey: "sales",
        matchPaths: ["/admin/pedidos", "/admin/clientes"]
      },
      {
        href: "/admin/produtos",
        label: "Catálogo",
        icon: Boxes,
        moduleKey: "catalog",
        matchPaths: ["/admin/produtos", "/admin/marcas", "/admin/categorias", "/admin/importar-produtos"],
        badge: outOfStockCount
      },
      {
        href: "/admin/analytics",
        label: "Relatórios",
        icon: BarChart3,
        moduleKey: "reports",
        matchPaths: ["/admin/analytics"]
      },
      {
        href: "/admin/loja",
        label: "Configurações",
        icon: Settings2,
        moduleKey: "settings",
        matchPaths: [
          "/admin/loja",
          "/admin/frete",
          "/admin/pagamentos",
          "/admin/politicas",
          "/admin/prontidao",
          "/admin/guias"
        ]
      }
    ],
    [outOfStockCount]
  );

  const currentItem = mainItems.find((item) => isActivePath(pathname, item));
  const currentPageLabel = getAdminPageLabel(pathname);
  const resultCount = searchResults.products.length + searchResults.orders.length + searchResults.customers.length;

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationOpen(false);
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setSearchOpen(false);
        setNotificationOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => {
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { notifications: AdminNotificationItem[]; unreadCount: number };
        if (!active) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch {
        // Keep the last successful notification snapshot.
      }
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchAbort.current?.abort();
  }, []);

  useEffect(() => {
    const container = searchOpen ? searchDialogRef.current : notificationOpen ? notificationDrawerRef.current : null;
    if (!container) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((element) => !element.hasAttribute("disabled"));
    focusable[0]?.focus();

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trapFocus);
    };
  }, [notificationOpen, searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults(emptySearchResults);
    setSearchLoading(false);
    searchAbort.current?.abort();
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchAbort.current?.abort();
    if (value.trim().length < 2) {
      setSearchResults(emptySearchResults);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(value.trim())}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Falha na busca");
        setSearchResults((await response.json()) as SearchResults);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSearchResults(emptySearchResults);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 220);
  }

  function markNotificationsRead(id?: string) {
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => (!id || item.id === id ? { ...item, readAt: item.readAt || now } : item)));
    setUnreadCount((current) => id ? Math.max(0, current - (notifications.find((item) => item.id === id && !item.readAt) ? 1 : 0)) : 0);
    fetch("/api/admin/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
      keepalive: true
    }).catch(() => undefined);
  }

  return (
    <main className={`admin-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      <button className="admin-mobile-backdrop" type="button" aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} />
      <aside className="admin-app-sidebar" aria-label="Navegação administrativa">
        <div className="admin-sidebar-brand-row">
          <Link className="admin-sidebar-brand" href="/admin" aria-label="RosaGiro Admin">
            <span className="admin-sidebar-logo">RG</span>
            <span className="admin-sidebar-brand-copy"><strong>RosaGiro</strong><small>Operações</small></span>
          </Link>
          <button className="admin-icon-button admin-mobile-close" type="button" aria-label="Fechar menu" title="Fechar menu" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <nav className="admin-primary-nav">
          <div className="admin-nav-group">
            <span className="admin-nav-label">Menu principal</span>
            {mainItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item);
              return (
                <Link
                  className={`admin-nav-link${active ? " is-active" : ""}`}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
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
        </nav>

        <div className="admin-sidebar-footer">
          <Link className="admin-sidebar-store-link" href="/" target="_blank" rel="noreferrer" title={collapsed ? "Abrir loja" : undefined}>
            <Store size={17} />
            <span>Abrir loja</span>
            <ExternalLink size={14} />
          </Link>
          <button className="admin-collapse-button" type="button" aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>{collapsed ? "Expandir" : "Recolher menu"}</span>
          </button>
        </div>
      </aside>

      <section className="admin-app-main">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button className="admin-icon-button admin-menu-button" type="button" aria-label="Abrir menu" title="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="admin-breadcrumb">
              <span>Admin</span>
              <ChevronRight size={14} />
              {currentPageLabel ? (
                <>
                  <span>{currentItem?.label || "Operações"}</span>
                  <ChevronRight size={14} />
                  <strong>{currentPageLabel}</strong>
                </>
              ) : (
                <strong>{currentItem?.label || "Operações"}</strong>
              )}
            </div>
          </div>

          <div className="admin-topbar-actions">
            <button className="admin-search-trigger" type="button" onClick={() => { setSearchOpen(true); setNotificationOpen(false); }}>
              <Search size={17} /><span>Buscar no admin</span>
            </button>
            <button className="admin-icon-button admin-notification-trigger" type="button" aria-label="Notificações" title="Notificações" onClick={() => { setNotificationOpen((value) => !value); setSearchOpen(false); }}>
              <Bell size={19} />{unreadCount ? <small>{Math.min(unreadCount, 99)}</small> : null}
            </button>
            <div className="admin-user-menu">
              <span className="admin-user-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
              <span className="admin-user-copy"><strong>{adminName}</strong><small>Administrador</small></span>
              <form action={logoutAction}><button className="admin-icon-button" type="submit" aria-label="Sair" title="Sair"><LogOut size={17} /></button></form>
            </div>
          </div>
        </header>

        {currentItem ? <AdminSectionNav moduleKey={currentItem.moduleKey} /> : null}
        <div className="admin-page-content">{children}</div>
      </section>

      {searchOpen ? (
        <div className="admin-command-layer" role="presentation">
          <button className="admin-command-backdrop" type="button" aria-label="Fechar busca" onClick={closeSearch} />
          <section className="admin-command-dialog" role="dialog" aria-modal="true" aria-label="Busca global" ref={searchDialogRef}>
            <div className="admin-command-input-row">
              <Search size={19} />
              <input value={searchQuery} onChange={(event) => handleSearch(event.target.value)} placeholder="Produto, modelo, pedido, cliente ou WhatsApp" autoFocus />
              {searchLoading ? <LoaderCircle className="admin-spin" size={18} /> : <button type="button" aria-label="Fechar busca" title="Fechar" onClick={closeSearch}><X size={17} /></button>}
            </div>
            <div className="admin-command-results">
              {searchQuery.trim().length < 2 ? <div className="admin-command-empty">Digite pelo menos 2 caracteres.</div> : null}
              {!searchLoading && searchQuery.trim().length >= 2 && resultCount === 0 ? <div className="admin-command-empty">Nenhum resultado encontrado.</div> : null}
              {searchResults.products.length ? <div className="admin-command-group"><span>Produtos</span>{searchResults.products.map((item) => <Link href={`/admin/produtos/${item.slug}`} onClick={closeSearch} key={item.id}><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.brand.name} · {item.active ? "Ativo" : "Inativo"}</small></div><ChevronRight size={16} /></Link>)}</div> : null}
              {searchResults.orders.length ? <div className="admin-command-group"><span>Pedidos</span>{searchResults.orders.map((item) => <Link href={`/admin/pedidos/${item.orderNumber}`} onClick={closeSearch} key={item.id}><span className="admin-command-icon"><ShoppingBag size={17} /></span><div><strong>{item.orderNumber} · {item.customerName}</strong><small>{item.customerPhone} · {compactMoney(item.totalCents)}</small></div><ChevronRight size={16} /></Link>)}</div> : null}
              {searchResults.customers.length ? <div className="admin-command-group"><span>Clientes</span>{searchResults.customers.map((item) => <Link href={`/admin/pedidos?q=${encodeURIComponent(item.whatsapp)}`} onClick={closeSearch} key={item.id}><span className="admin-command-icon"><UserRound size={17} /></span><div><strong>{item.name}</strong><small>{item.whatsapp} · {item._count.orders} pedidos</small></div><ChevronRight size={16} /></Link>)}</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {notificationOpen ? (
        <div className="admin-notification-layer">
          <button className="admin-notification-backdrop" type="button" aria-label="Fechar notificações" onClick={() => setNotificationOpen(false)} />
          <aside className="admin-notification-drawer" aria-label="Central de notificações" ref={notificationDrawerRef}>
            <div className="admin-notification-heading"><div><span>Operação</span><h2>Notificações</h2></div><button className="admin-icon-button" type="button" aria-label="Fechar notificações" title="Fechar" onClick={() => setNotificationOpen(false)}><X size={17} /></button></div>
            {unreadCount ? <button className="admin-mark-all" type="button" onClick={() => markNotificationsRead()}><CheckCheck size={16} />Marcar todas como lidas</button> : null}
            <div className="admin-notification-list">
              {notifications.map((notification) => (
                <Link className={notification.readAt ? "" : "is-unread"} href={notification.actionHref} onClick={() => markNotificationsRead(notification.id)} key={notification.id}>
                  <span className={notification.notificationType === "ORDER_PAID" ? "is-paid" : "is-order"}>{notification.notificationType === "ORDER_PAID" ? <CircleDollarSign size={18} /> : <ShoppingBag size={18} />}</span>
                  <div><strong>{notification.title}</strong><p>{notification.message}</p><small>{notificationTime.format(new Date(notification.createdAt))}</small></div>
                </Link>
              ))}
              {!notifications.length ? <div className="admin-command-empty">Nenhuma notificação ainda.</div> : null}
            </div>
            <div className="admin-whatsapp-status"><MessageCircle size={17} /><div><strong>WhatsApp Cloud API</strong><small>Ainda não configurada; nenhuma mensagem automática é enviada.</small></div></div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
