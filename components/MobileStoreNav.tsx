"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { WhatsAppLink } from "@/components/WhatsAppLink";

const navItems = [
  {
    href: "/",
    label: "Início",
    icon: House,
    isActive: (pathname: string) => pathname === "/"
  },
  {
    href: "/promocoes",
    label: "Destaques",
    icon: Sparkles,
    isActive: (pathname: string) => pathname.startsWith("/promocoes")
  },
  {
    href: "/categoria/all",
    label: "Categorias",
    icon: LayoutGrid,
    isActive: (pathname: string) => pathname.startsWith("/categoria") || pathname.startsWith("/marcas")
  },
  {
    href: "/carrinho",
    label: "Carrinho",
    icon: ShoppingBag,
    isActive: (pathname: string) =>
      pathname.startsWith("/carrinho") ||
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/pedido/") ||
      pathname.startsWith("/pagamento-simulado/")
  }
];

export function MobileStoreNav({ whatsappHref }: { whatsappHref: string }) {
  const pathname = usePathname();

  return (
    <nav className="mobile-tabs" aria-label="Navegação principal">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive(pathname);

        return (
          <Link href={item.href} aria-current={active ? "page" : undefined} key={item.href}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <WhatsAppLink
        className="mobile-tab-whatsapp"
        href={whatsappHref}
        ariaLabel="Abrir atendimento no WhatsApp"
      >
        <MessageCircle aria-hidden="true" />
        <span>WhatsApp</span>
      </WhatsAppLink>
    </nav>
  );
}
