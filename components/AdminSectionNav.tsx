"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAdminLanguage } from "@/components/AdminLanguageProvider";
import type { AdminLocale } from "@/lib/admin-i18n";

export type AdminModuleKey = "overview" | "sales" | "catalog" | "reports" | "settings";

type SectionLink = {
  href: string;
  label: string;
  labelZh: string;
  matchPrefixes?: string[];
  excludePrefixes?: string[];
};

type SectionMenu = {
  label: string;
  labelZh: string;
  items: SectionLink[];
};

type SectionConfig = {
  label: string;
  labelZh: string;
  links: SectionLink[];
  menus?: SectionMenu[];
};

const sectionConfigs: Partial<Record<AdminModuleKey, SectionConfig>> = {
  sales: {
    label: "Vendas",
    labelZh: "销售",
    links: [
      { href: "/admin/pedidos", label: "Pedidos", labelZh: "订单", matchPrefixes: ["/admin/pedidos"] },
      { href: "/admin/clientes", label: "Clientes", labelZh: "客户", matchPrefixes: ["/admin/clientes"] },
      { href: "/admin/leads", label: "Leads", labelZh: "WhatsApp 询盘", matchPrefixes: ["/admin/leads"] }
    ]
  },
  catalog: {
    label: "Catálogo",
    labelZh: "商品目录",
    links: [
      {
        href: "/admin/produtos",
        label: "Produtos",
        labelZh: "商品",
        matchPrefixes: ["/admin/produtos"],
        excludePrefixes: ["/admin/produtos/qualidade", "/admin/produtos/lixeira"]
      },
      {
        href: "/admin/produtos/qualidade",
        label: "Qualidade",
        labelZh: "质量检查",
        matchPrefixes: ["/admin/produtos/qualidade"]
      }
    ],
    menus: [
      {
        label: "Estrutura",
        labelZh: "目录管理",
        items: [
          { href: "/admin/marcas", label: "Marcas", labelZh: "品牌", matchPrefixes: ["/admin/marcas"] },
          { href: "/admin/categorias", label: "Categorias", labelZh: "品类", matchPrefixes: ["/admin/categorias"] }
        ]
      },
      {
        label: "Ferramentas",
        labelZh: "更多工具",
        items: [
          {
            href: "/admin/catalogo-clientes",
            label: "Catálogo para clientes",
            labelZh: "客户货盘目录",
            matchPrefixes: ["/admin/catalogo-clientes"]
          },
          {
            href: "/admin/importar-produtos",
            label: "Importar e exportar",
            labelZh: "导入与导出",
            matchPrefixes: ["/admin/importar-produtos"]
          },
          {
            href: "/admin/produtos/lixeira",
            label: "Lixeira",
            labelZh: "回收站",
            matchPrefixes: ["/admin/produtos/lixeira"]
          }
        ]
      }
    ]
  },
  settings: {
    label: "Configurações",
    labelZh: "设置",
    links: [
      { href: "/admin/loja", label: "Loja", labelZh: "店铺资料", matchPrefixes: ["/admin/loja"] },
      { href: "/admin/frete", label: "Frete", labelZh: "运费", matchPrefixes: ["/admin/frete"] },
      { href: "/admin/pagamentos", label: "Pagamentos", labelZh: "支付", matchPrefixes: ["/admin/pagamentos"] },
      { href: "/admin/politicas", label: "Políticas", labelZh: "政策", matchPrefixes: ["/admin/politicas"] },
      { href: "/admin/prontidao", label: "Sistema", labelZh: "系统状态", matchPrefixes: ["/admin/prontidao"] },
      { href: "/admin/guias", label: "Conteúdo", labelZh: "内容", matchPrefixes: ["/admin/guias"] }
    ]
  }
};

const pageLabels: Array<{ prefix: string; label: string; labelZh: string }> = [
  { prefix: "/admin/catalogo-clientes/imprimir", label: "Imprimir catálogo", labelZh: "打印目录" },
  { prefix: "/admin/catalogo-clientes", label: "Catálogo para clientes", labelZh: "客户货盘目录" },
  { prefix: "/admin/produtos/qualidade", label: "Qualidade", labelZh: "质量检查" },
  { prefix: "/admin/produtos/lixeira", label: "Lixeira", labelZh: "回收站" },
  { prefix: "/admin/produtos/novo", label: "Novo produto", labelZh: "新建商品" },
  { prefix: "/admin/produtos/", label: "Editar produto", labelZh: "编辑商品" },
  { prefix: "/admin/produtos", label: "Produtos", labelZh: "商品" },
  { prefix: "/admin/importar-produtos", label: "Importar e exportar", labelZh: "导入与导出" },
  { prefix: "/admin/marcas", label: "Marcas", labelZh: "品牌" },
  { prefix: "/admin/categorias", label: "Categorias", labelZh: "品类" },
  { prefix: "/admin/pedidos/", label: "Detalhes do pedido", labelZh: "订单详情" },
  { prefix: "/admin/pedidos", label: "Pedidos", labelZh: "订单" },
  { prefix: "/admin/clientes", label: "Clientes", labelZh: "客户" },
  { prefix: "/admin/leads", label: "Leads do WhatsApp", labelZh: "WhatsApp 询盘" },
  { prefix: "/admin/analytics", label: "Relatórios", labelZh: "经营报表" },
  { prefix: "/admin/loja", label: "Loja", labelZh: "店铺资料" },
  { prefix: "/admin/frete", label: "Frete", labelZh: "运费" },
  { prefix: "/admin/pagamentos", label: "Pagamentos", labelZh: "支付" },
  { prefix: "/admin/politicas", label: "Políticas", labelZh: "政策" },
  { prefix: "/admin/prontidao", label: "Sistema", labelZh: "系统状态" },
  { prefix: "/admin/guias", label: "Conteúdo", labelZh: "内容" }
];

function matchesLink(pathname: string, item: SectionLink) {
  if (item.excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  const prefixes = item.matchPrefixes || [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAdminPageLabel(pathname: string, locale: AdminLocale = "pt-BR") {
  const item = pageLabels.find((entry) => pathname === entry.prefix || pathname.startsWith(entry.prefix));
  if (!item) return null;
  return locale === "zh-CN" ? item.labelZh : item.label;
}

export function AdminSectionNav({ moduleKey }: { moduleKey: AdminModuleKey }) {
  const { t } = useAdminLanguage();
  const pathname = usePathname();
  const config = sectionConfigs[moduleKey];
  if (!config) return null;

  return (
    <div className="admin-section-nav-shell">
      <nav className="admin-section-nav" aria-label={t(`Navegação de ${config.label}`, `${config.labelZh}导航`)} key={pathname}>
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
                {t(item.label, item.labelZh)}
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
                    <span>{t(menu.label, menu.labelZh)}</span>
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
                          {t(item.label, item.labelZh)}
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
