export const LEGACY_GUIDE_COVER = "/assets/rosagiro-atacado-hero.webp";

export const procurementGuideCovers = {
  "como-montar-pedido-misto-atacado": {
    coverImage: LEGACY_GUIDE_COVER,
    coverImageAlt: "Cena ilustrativa de produtos de beleza e caixas organizados para um pedido misto."
  },
  "entenda-caixa-fechada-caixa-master-e-minimo-por-item": {
    coverImage: "/assets/guides/caixa-fechada-master.webp",
    coverImageAlt: "Imagem ilustrativa de uma caixa master com caixas menores e um expositor de gloss."
  },
  "como-funciona-frete-e-retirada-no-atacado": {
    coverImage: "/assets/guides/frete-retirada.webp",
    coverImageAlt: "Cena ilustrativa de entrega de um pacote no balcão de uma loja de cosméticos."
  }
} as const;

type GuideCover = {
  slug: string;
  coverImage: string | null;
  coverImageAlt: string | null;
};

export function withGuideCover<T extends GuideCover>(article: T): T {
  // Replace only the shared legacy cover, preserving editorial uploads and empty covers.
  if (article.coverImage !== LEGACY_GUIDE_COVER) return article;
  const cover = procurementGuideCovers[article.slug as keyof typeof procurementGuideCovers];
  return cover ? { ...article, ...cover } : article;
}
