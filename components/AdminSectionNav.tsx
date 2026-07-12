"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

export type AdminModuleKey = "overview" | "sales" | "catalog" | "reports" | "settings";

type SectionLink = {
  href: string;
  label: string;
  matchPrefixes?: string[];
  excludePrefixes?: string[];
};

type SectionMenu = {
  label: string;
  items: SectionLink[];
};

type SectionConfig = {
  label: string;
  links: SectionLink[];
  menus?: SectionMenu[];
};

const sectionConfigs: Partial<Record<AdminModuleKey, SectionConfig>> = {
  sales: {
    label: "Vendas",
    links: [
      { href: "/admin/pedidos", label: "Pedidos", matchPrefixes: ["/admin/pedidos"] },
      { href: "/admin/clientes", label: "Clientes", matchPrefixes: ["/admin/clientes"] },
      { href: "/admin/leads", label: "Leads", matchPrefixes: ["/admin/leads"] }
    ]
  },
  catalog: {
    label: "Catálogo",
    links: [
      {
        href: "/admin/produtos",
        label: "Produtos",
        matchPrefixes: ["/admin/produtos"],
        excludePrefixes: ["/admin/produtos/qualidade", "/admin/produtos/lixeira"]
      },
      {
        href: "/admin/produtos/qualidade",
        label: "Qualidade",
        matchPrefixes: ["/admin/produtos/qualidade"]
      }
    ],
    menus: [
      {
        label: "Estrutura",
        items: [
          { href: "/admin/marcas", label: "Marcas", matchPrefixes: ["/admin/marcas"] },
          { href: "/admin/categorias", label: "Categorias", matchPrefixes: ["/admin/categorias"] }
        ]
      },
      {
        label: "Ferramentas",
        items: [
          {
            href: "/admin/catalogo-clientes",
            label: "Catálogo para clientes",
            matchPrefixes: ["/admin/catalogo-clientes"]
          },
          {
            href: "/admin/importar-produtos",
            label: "Importar e exportar",
            matchPrefixes: ["/admin/importar-produtos"]
          },
          {
            href: "/admin/produtos/lixeira",
            label: "Lixeira",
            matchPrefixes: ["/admin/produtos/lixeira"]
          }
        ]
      }
    ]
  },
  settings: {
    label: "Configurações",
    links: [
      { href: "/admin/loja", label: "Loja", matchPrefixes: ["/admin/loja"] },
      { href: "/admin/frete", label: "Frete", matchPrefixes: ["/admin/frete"] },
      { href: "/admin/pagamentos", label: "Pagamentos", matchPrefixes: ["/admin/pagamentos"] },
      { href: "/admin/politicas", label: "Políticas", matchPrefixes: ["/admin/politicas"] },
      { href: "/admin/prontidao", label: "Sistema", matchPrefixes: ["/admin/prontidao"] },
      { href: "/admin/guias", label: "Conteúdo", matchPrefixes: ["/admin/guias"] }
    ]
  }
};

const pageLabels: Array<{ prefix: string; label: string }> = [
  { prefix: "/admin/catalogo-clientes/imprimir", label: "Imprimir catálogo" },
  { prefix: "/admin/catalogo-clientes", label: "Catálogo para clientes" },
  { prefix: "/admin/produtos/qualidade", label: "Qualidade" },
  { prefix: "/admin/produtos/lixeira", label: "Lixeira" },
  { prefix: "/admin/produtos/novo", label: "Novo produto" },
  { prefix: "/admin/produtos/", label: "Editar produto" },
  { prefix: "/admin/produtos", label: "Produtos" },
  { prefix: "/admin/importar-produtos", label: "Importar e exportar" },
  { prefix: "/admin/marcas", label: "Marcas" },
  { prefix: "/admin/categorias", label: "Categorias" },
  { prefix: "/admin/pedidos/", label: "Detalhes do pedido" },
  { prefix: "/admin/pedidos", label: "Pedidos" },
  { prefix: "/admin/clientes", label: "Clientes" },
  { prefix: "/admin/leads", label: "Leads do WhatsApp" },
  { prefix: "/admin/analytics", label: "Relatórios" },
  { prefix: "/admin/loja", label: "Loja" },
  { prefix: "/admin/frete", label: "Frete" },
  { prefix: "/admin/pagamentos", label: "Pagamentos" },
  { prefix: "/admin/politicas", label: "Políticas" },
  { prefix: "/admin/prontidao", label: "Sistema" },
  { prefix: "/admin/guias", label: "Conteúdo" }
];

function matchesLink(pathname: string, item: SectionLink) {
  if (item.excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  const prefixes = item.matchPrefixes || [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAdminPageLabel(pathname: string) {
  return pageLabels.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix))?.label || null;
}

export function AdminSectionNav({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const pathname = usePathname();
  const config = sectionConfigs[moduleKey];
  if (!config) return null;

  return (
    <div className="admin-section-nav-shell">
      <nav className="admin-section-nav" aria-label={`Navegação de ${config.label}`} key={pathname}>
        <div className="admin-section-tabs">
          {config.links.map((item) => {
            const active = matchesLink(pathname, item);
            return (
              <Link
                className={`admin-section-link${active ? " is-active" : ""}`}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {config.menus?.length ? (
          <div className="admin-section-actions">
            {config.menus.map((menu) => {
              const active = menu.items.some((item) => matchesLink(pathname, item));
              return (
                <details className={`admin-section-menu${active ? " is-active" : ""}`} key={menu.label}>
                  <summary>
                    <span>{menu.label}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="admin-section-menu-popover">
                    {menu.items.map((item) => {
                      const itemActive = matchesLink(pathname, item);
                      return (
                        <Link
                          className={itemActive ? "is-active" : ""}
                          href={item.href}
                          prefetch={false}
                          aria-current={itemActive ? "page" : undefined}
                          key={item.href}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
