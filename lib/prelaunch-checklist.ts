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
    summary: "Validar Melhor Envio em produção, origem, CEPs, pesos técnicos, seguro, retirada e exceções.",
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

export const prelaunchStepsZh: PrelaunchStep[] = [
  { index: 1, title: "冻结本地基线", summary: "确认 Git 工作区清晰、构建通过，并确保 .env.local 仅保存在开发电脑。", actionHref: "/admin/prontidao", actionLabel: "查看检查" },
  { index: 2, title: "补全店铺真实资料", summary: "填写真实 CNPJ、州税号、公司名称、地址、WhatsApp、电子邮箱、营业时间和社交平台。", actionHref: "/admin/loja", actionLabel: "编辑店铺" },
  { index: 3, title: "复核公开政策", summary: "依据真实客服流程和 LGPD 完善隐私、条款、换货、配送和联系方式。", actionHref: "/admin/politicas", actionLabel: "编辑政策" },
  { index: 4, title: "完善商品目录与图片", summary: "替换 SVG，核对库存、价格、重量、保质期或批次、图库及批发资料。", actionHref: "/admin/produtos/qualidade", actionLabel: "查看质量" },
  { index: 5, title: "准备图片持久存储", summary: "部署 Vercel 前将本地上传迁移至 S3、R2、Vercel Blob 或其他持久存储。", actionHref: "/admin/produtos/qualidade", actionLabel: "查看图片" },
  { index: 6, title: "确认运费与运营规则", summary: "核对 Melhor Envio 正式环境、发货邮编、重量、技术包装参数、保险、自提和异常地区。", actionHref: "/admin/frete", actionLabel: "查看运费" },
  { index: 7, title: "验证 Mercado Pago 沙盒与正式模式", summary: "先配置沙盒测试，再使用正式令牌、Webhook 密钥和公开 HTTPS URL 切换正式付款。", actionHref: "/admin/pagamentos", actionLabel: "查看支付" },
  { index: 8, title: "配置生产环境", summary: "准备域名、Vercel、生产 PostgreSQL、备份、环境变量和数据库迁移。", actionHref: "/admin/prontidao", actionLabel: "查看部署" },
  { index: 9, title: "审查 SEO 与销售渠道", summary: "检查 metadata、sitemap、robots、llms.txt、Search Console 及后续 Merchant / Ads 接入。", actionHref: "/admin/prontidao", actionLabel: "查看 SEO" },
  { index: 10, title: "完成全流程下单测试", summary: "在手机和桌面验证目录、商品、WhatsApp、购物车、结账、运费、付款和订单。", actionHref: "/admin/pedidos", actionLabel: "查看订单" },
  { index: 11, title: "进行可控试运营", summary: "先开放少量 SKU，每日跟踪 WhatsApp、付款、库存、运费和结账错误。", actionHref: "/admin/prontidao", actionLabel: "跟踪状态" }
];

export const prelaunchGoNoGoGatesZh: PrelaunchGate[] = [
  { label: "店铺主体真实明确", detail: "CNPJ、地址、WhatsApp、电子邮箱、营业时间和最终政策均已填写。" },
  { label: "商品可以销售", detail: "启用商品不使用演示 SVG；重点商品具备真实图片、库存、价格、重量和保质期或批次资料。" },
  { label: "图片使用持久存储", detail: "真实商品图片不依赖本地 public/uploads，可在部署或更换服务器后继续使用。" },
  { label: "付款已经验证", detail: "Mercado Pago 沙盒和正式付款均已测试；Webhook 与库存流程正常，模拟付款不会作为正式付款展示。" },
  { label: "运营环境受保护", detail: "生产数据库、备份、密钥变量、运费、移动端结账和回滚方案均已核对。" }
];
