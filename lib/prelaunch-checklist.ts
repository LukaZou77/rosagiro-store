export type PrelaunchStep = {
  index: number;
  title: string;
  summary: string;
  actionHref: string;
  actionLabel: string;
};

export type PrelaunchGate = {
  label: string;
  detail: string;
};

export const prelaunchSteps: PrelaunchStep[] = [
  {
    index: 1,
    title: "Congelar a base local",
    summary: "Confirmar git limpo, build aprovado e .env.local restrito ao computador de desenvolvimento.",
    actionHref: "/admin/prontidao",
    actionLabel: "Ver checks"
  },
  {
    index: 2,
    title: "Completar dados reais da loja",
    summary: "Trocar CNPJ, IE, razão social, endereço, WhatsApp, e-mail, horários e redes sociais.",
    actionHref: "/admin/loja",
    actionLabel: "Editar loja"
  },
  {
    index: 3,
    title: "Revisar políticas públicas",
    summary: "Finalizar privacidade, termos, trocas, entrega e contato com regras reais de atendimento e LGPD.",
    actionHref: "/admin/politicas",
    actionLabel: "Editar políticas"
  },
  {
    index: 4,
    title: "Realizar catálogo e mídia",
    summary: "Substituir SVGs, validar estoque, preço, peso, validade/lote, galeria e dados de atacado.",
    actionHref: "/admin/produtos/qualidade",
    actionLabel: "Ver qualidade"
  },
  {
    index: 5,
    title: "Preparar storage de imagens",
    summary: "Migrar uploads locais para S3, R2, Vercel Blob ou outro armazenamento persistente antes da Vercel.",
    actionHref: "/admin/produtos/qualidade",
    actionLabel: "Ver mídia"
  },
  {
    index: 6,
    title: "Confirmar frete e regras operacionais",
    summary: "Validar tabela Anjun, origem, CEPs, peso, seguro, impostos, área de risco, retirada e excursão.",
    actionHref: "/admin/frete",
    actionLabel: "Ver frete"
  },
  {
    index: 7,
    title: "Validar Mercado Pago sandbox e live",
    summary: "Configurar sandbox para testes; depois trocar para live com token, webhook secret e URL HTTPS pública.",
    actionHref: "/admin/pagamentos",
    actionLabel: "Ver pagamentos"
  },
  {
    index: 8,
    title: "Configurar produção",
    summary: "Preparar domínio, Vercel, PostgreSQL de produção, backups, variáveis e migrate deploy.",
    actionHref: "/admin/prontidao",
    actionLabel: "Ver deploy"
  },
  {
    index: 9,
    title: "Auditar SEO e canais comerciais",
    summary: "Checar metadata, sitemap, robots, llms.txt, Search Console e futuras entradas Merchant/Ads.",
    actionHref: "/admin/prontidao",
    actionLabel: "Ver SEO"
  },
  {
    index: 10,
    title: "Rodar compra completa",
    summary: "Testar mobile e desktop: catálogo, produto, WhatsApp, carrinho, checkout, frete, pagamento e pedido.",
    actionHref: "/admin/pedidos",
    actionLabel: "Ver pedidos"
  },
  {
    index: 11,
    title: "Fazer soft launch controlado",
    summary: "Abrir com poucos SKUs e acompanhar WhatsApp, pagamentos, estoque, frete e erros de checkout diariamente.",
    actionHref: "/admin/prontidao",
    actionLabel: "Acompanhar"
  }
];

export const prelaunchGoNoGoGates: PrelaunchGate[] = [
  {
    label: "Loja real identificada",
    detail: "CNPJ, endereço, WhatsApp, e-mail, horários e políticas finais estão preenchidos."
  },
  {
    label: "Catálogo vendável",
    detail: "Produtos ativos não usam SVG demo; itens-chave têm fotos reais, estoque, preço, peso e validade/lote."
  },
  {
    label: "Storage persistente",
    detail: "Fotos reais não dependem de public/uploads local para sobreviver a deploy ou troca de servidor."
  },
  {
    label: "Pagamento validado",
    detail: "Mercado Pago sandbox e live passaram; webhook e estoque funcionam, e simulado não aparece como pagamento oficial."
  },
  {
    label: "Operação protegida",
    detail: "Banco de produção, backup, variáveis secretas, frete, mobile checkout e rollback foram conferidos."
  }
];
