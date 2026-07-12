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
import { AdminLanguageSwitch, useAdminLanguage } from "@/components/AdminLanguageProvider";
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
type NotificationPayload = { notifications?: AdminNotificationItem[]; unreadCount: number };
function isActivePath(pathname: string, item: NavItem) {
  return item.matchPaths.some((path) => pathname === path || (!item.exact && pathname.startsWith(`${path}/`)));
}

function compactMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function localizedNotificationCopy(notification: AdminNotificationItem, locale: string) {
  if (locale !== "zh-CN") return { title: notification.title, message: notification.message };
  const match = /^(.*?) de (.*?) foi (?:pago|criado) \((.*?)\)\.$/.exec(notification.message);
  const title = notification.notificationType === "ORDER_PAID" ? "付款已确认" : "收到新订单";
  if (!match) return { title, message: notification.message };
  const [, orderNumber, customerName, total] = match;
  return {
    title,
    message: notification.notificationType === "ORDER_PAID"
      ? `${orderNumber}，客户 ${customerName} 已付款（${total}）。`
      : `${orderNumber}，客户 ${customerName} 已创建订单（${total}）。`
  };
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
  const { locale, t } = useAdminLanguage();
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
  const notificationTime = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }), [locale]);

  const mainItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/admin",
        label: t("Visão geral", "经营总览"),
        icon: LayoutDashboard,
        moduleKey: "overview",
        matchPaths: ["/admin"],
        exact: true
      },
      {
        href: "/admin/pedidos",
        label: t("Vendas", "销售"),
        icon: ShoppingBag,
        moduleKey: "sales",
        matchPaths: ["/admin/pedidos", "/admin/clientes", "/admin/leads"]
      },
      {
        href: "/admin/produtos",
        label: t("Catálogo", "商品目录"),
        icon: Boxes,
        moduleKey: "catalog",
        matchPaths: [
          "/admin/produtos",
          "/admin/marcas",
          "/admin/categorias",
          "/admin/importar-produtos",
          "/admin/catalogo-clientes"
        ],
        badge: outOfStockCount
      },
      {
        href: "/admin/analytics",
        label: t("Relatórios", "经营报表"),
        icon: BarChart3,
        moduleKey: "reports",
        matchPaths: ["/admin/analytics"]
      },
      {
        href: "/admin/loja",
        label: t("Configurações", "设置"),
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
    [outOfStockCount, t]
  );

  const currentItem = mainItems.find((item) => isActivePath(pathname, item));
  const currentPageLabel = getAdminPageLabel(pathname, locale);
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
    async function refreshNotificationSummary() {
      try {
        const response = await fetch("/api/admin/notifications?summary=1", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as NotificationPayload;
        if (!active) return;
        setUnreadCount(data.unreadCount);
      } catch {
        // Keep the last successful unread count.
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refreshNotificationSummary();
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNotificationSummary();
    }, 120_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;
    let active = true;
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as NotificationPayload : null)
      .then((data) => {
        if (!active || !data) return;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [notificationOpen]);

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
    <main className={`admin-app notranslate${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`} translate="no">
      <button className="admin-mobile-backdrop" type="button" aria-label={t("Fechar navegação", "关闭导航")} onClick={() => setMobileOpen(false)} />
      <aside className="admin-app-sidebar" aria-label={t("Navegação administrativa", "后台导航")}>
        <div className="admin-sidebar-brand-row">
          <Link className="admin-sidebar-brand" href="/admin" prefetch={false} aria-label="RosaGiro Admin">
            <span className="admin-sidebar-logo">RG</span>
            <span className="admin-sidebar-brand-copy"><strong>RosaGiro</strong><small>{t("Operações", "运营后台")}</small></span>
          </Link>
          <button className="admin-icon-button admin-mobile-close" type="button" aria-label={t("Fechar menu", "关闭菜单")} title={t("Fechar menu", "关闭菜单")} onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <nav className="admin-primary-nav">
          <div className="admin-nav-group">
            <span className="admin-nav-label">{t("Menu principal", "主菜单")}</span>
            {mainItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item);
              return (
                <Link
                  className={`admin-nav-link${active ? " is-active" : ""}`}
                  href={item.href}
                  prefetch={false}
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
          <Link className="admin-sidebar-store-link" href="/" prefetch={false} target="_blank" rel="noreferrer" title={collapsed ? t("Abrir loja", "打开前台") : undefined}>
            <Store size={17} />
            <span>{t("Abrir loja", "打开前台")}</span>
            <ExternalLink size={14} />
          </Link>
          <button className="admin-collapse-button" type="button" aria-label={collapsed ? t("Expandir barra lateral", "展开侧栏") : t("Recolher barra lateral", "收起侧栏")} title={collapsed ? t("Expandir barra lateral", "展开侧栏") : t("Recolher barra lateral", "收起侧栏")} onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>{collapsed ? t("Expandir", "展开") : t("Recolher menu", "收起菜单")}</span>
          </button>
        </div>
      </aside>

      <section className="admin-app-main">
        <header className="admin-topbar">
          <div className="admin-topbar-leading">
            <button className="admin-icon-button admin-menu-button" type="button" aria-label={t("Abrir menu", "打开菜单")} title={t("Abrir menu", "打开菜单")} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="admin-breadcrumb">
              <span>Admin</span>
              <ChevronRight size={14} />
              {currentPageLabel ? (
                <>
                  <span>{currentItem?.label || t("Operações", "运营")}</span>
                  <ChevronRight size={14} />
                  <strong>{currentPageLabel}</strong>
                </>
              ) : (
                <strong>{currentItem?.label || t("Operações", "运营")}</strong>
              )}
            </div>
          </div>

          <div className="admin-topbar-actions">
            <button className="admin-search-trigger" type="button" onClick={() => { setSearchOpen(true); setNotificationOpen(false); }}>
              <Search size={17} /><span>{t("Buscar no admin", "搜索后台")}</span>
            </button>
            <AdminLanguageSwitch compact />
            <button className="admin-icon-button admin-notification-trigger" type="button" aria-label={t("Notificações", "通知")} title={t("Notificações", "通知")} onClick={() => { setNotificationOpen((value) => !value); setSearchOpen(false); }}>
              <Bell size={19} />{unreadCount ? <small>{Math.min(unreadCount, 99)}</small> : null}
            </button>
            <div className="admin-user-menu">
              <span className="admin-user-avatar">{adminName.slice(0, 1).toUpperCase()}</span>
              <span className="admin-user-copy"><strong>{adminName}</strong><small>{t("Administrador", "管理员")}</small></span>
              <form action={logoutAction}><button className="admin-icon-button" type="submit" aria-label={t("Sair", "退出") } title={t("Sair", "退出")}><LogOut size={17} /></button></form>
            </div>
          </div>
        </header>

        {currentItem ? <AdminSectionNav moduleKey={currentItem.moduleKey} /> : null}
        <div className="admin-page-content">{children}</div>
      </section>

      {searchOpen ? (
        <div className="admin-command-layer" role="presentation">
          <button className="admin-command-backdrop" type="button" aria-label={t("Fechar busca", "关闭搜索")} onClick={closeSearch} />
          <section className="admin-command-dialog" role="dialog" aria-modal="true" aria-label={t("Busca global", "全局搜索")} ref={searchDialogRef}>
            <div className="admin-command-input-row">
              <Search size={19} />
              <input value={searchQuery} onChange={(event) => handleSearch(event.target.value)} placeholder={t("Produto, modelo, pedido, cliente ou WhatsApp", "商品、型号、订单、客户或 WhatsApp")} autoFocus />
              {searchLoading ? <LoaderCircle className="admin-spin" size={18} /> : <button type="button" aria-label={t("Fechar busca", "关闭搜索")} title={t("Fechar", "关闭")} onClick={closeSearch}><X size={17} /></button>}
            </div>
            <div className="admin-command-results">
              {searchQuery.trim().length < 2 ? <div className="admin-command-empty">{t("Digite pelo menos 2 caracteres.", "请至少输入 2 个字符。")}</div> : null}
              {!searchLoading && searchQuery.trim().length >= 2 && resultCount === 0 ? <div className="admin-command-empty">{t("Nenhum resultado encontrado.", "未找到结果。")}</div> : null}
              {searchResults.products.length ? <div className="admin-command-group"><span>{t("Produtos", "商品")}</span>{searchResults.products.map((item) => <Link href={`/admin/produtos/${item.slug}`} prefetch={false} onClick={closeSearch} key={item.id}><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.brand.name} · {item.active ? t("Ativo", "启用") : t("Inativo", "停用")}</small></div><ChevronRight size={16} /></Link>)}</div> : null}
              {searchResults.orders.length ? <div className="admin-command-group"><span>{t("Pedidos", "订单")}</span>{searchResults.orders.map((item) => <Link href={`/admin/pedidos/${item.orderNumber}`} prefetch={false} onClick={closeSearch} key={item.id}><span className="admin-command-icon"><ShoppingBag size={17} /></span><div><strong>{item.orderNumber} · {item.customerName}</strong><small>{item.customerPhone} · {compactMoney(item.totalCents)}</small></div><ChevronRight size={16} /></Link>)}</div> : null}
              {searchResults.customers.length ? <div className="admin-command-group"><span>{t("Clientes", "客户")}</span>{searchResults.customers.map((item) => <Link href={`/admin/pedidos?q=${encodeURIComponent(item.whatsapp)}`} prefetch={false} onClick={closeSearch} key={item.id}><span className="admin-command-icon"><UserRound size={17} /></span><div><strong>{item.name}</strong><small>{item.whatsapp} · {item._count.orders} {t("pedidos", "个订单")}</small></div><ChevronRight size={16} /></Link>)}</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {notificationOpen ? (
        <div className="admin-notification-layer">
          <button className="admin-notification-backdrop" type="button" aria-label={t("Fechar notificações", "关闭通知")} onClick={() => setNotificationOpen(false)} />
          <aside className="admin-notification-drawer" aria-label={t("Central de notificações", "通知中心")} ref={notificationDrawerRef}>
            <div className="admin-notification-heading"><div><span>{t("Operação", "运营")}</span><h2>{t("Notificações", "通知")}</h2></div><button className="admin-icon-button" type="button" aria-label={t("Fechar notificações", "关闭通知")} title={t("Fechar", "关闭")} onClick={() => setNotificationOpen(false)}><X size={17} /></button></div>
            {unreadCount ? <button className="admin-mark-all" type="button" onClick={() => markNotificationsRead()}><CheckCheck size={16} />{t("Marcar todas como lidas", "全部标为已读")}</button> : null}
            <div className="admin-notification-list">
              {notifications.map((notification) => {
                const copy = localizedNotificationCopy(notification, locale);
                return (
                  <Link className={notification.readAt ? "" : "is-unread"} href={notification.actionHref} prefetch={false} onClick={() => markNotificationsRead(notification.id)} key={notification.id}>
                    <span className={notification.notificationType === "ORDER_PAID" ? "is-paid" : "is-order"}>{notification.notificationType === "ORDER_PAID" ? <CircleDollarSign size={18} /> : <ShoppingBag size={18} />}</span>
                    <div><strong>{copy.title}</strong><p>{copy.message}</p><small>{notificationTime.format(new Date(notification.createdAt))}</small></div>
                  </Link>
                );
              })}
              {!notifications.length ? <div className="admin-command-empty">{t("Nenhuma notificação ainda.", "暂无通知。")}</div> : null}
            </div>
            <div className="admin-whatsapp-status"><MessageCircle size={17} /><div><strong>WhatsApp Cloud API</strong><small>{t("Ainda não configurada; nenhuma mensagem automática é enviada.", "尚未配置，不会自动发送消息。")}</small></div></div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
