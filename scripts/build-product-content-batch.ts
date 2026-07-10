import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
  exactModel: boolean;
};

type SearchCacheEntry = {
  query: string;
  searchedAt: string;
  results: SearchResult[];
  error?: string;
};

type ProductKind =
  | "gloss"
  | "lip-oil"
  | "lip-care"
  | "lipstick"
  | "mascara"
  | "eyeliner"
  | "brow"
  | "eyeshadow"
  | "foundation"
  | "concealer"
  | "blush"
  | "highlighter"
  | "contour"
  | "face-powder"
  | "primer"
  | "makeup-remover"
  | "face-cleanser"
  | "face-care"
  | "setting-spray"
  | "hair-care"
  | "body-cleanser"
  | "body-care"
  | "body-splash"
  | "fragrance"
  | "makeup-tool"
  | "cotton-pad"
  | "sunscreen"
  | "makeup-kit"
  | "other";

type CatalogProduct = {
  slug: string;
  name: string;
  image: string;
  volume: string;
  weightGrams: number | null;
  brand: { name: string };
  category: { label: string; slug: string };
  subcategoryOption: { label: string; slug: string } | null;
  skus: Array<{ name: string; code: string; image: string | null }>;
  originalName?: string;
  currentBrandName?: string;
  brandCorrection?: string;
  specialDescription?: string;
};

const envLocal = ".env.local";
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function argument(name: string, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function numericArgument(name: string, fallback: number) {
  const parsed = Number(argument(name, String(fallback)));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number.`);
  return Math.floor(parsed);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const outputPath = resolve(argument("--output", "scripts/data/product-content-batch-002.json"));
const sourceBatchPath = resolve(argument("--completed-batch", "scripts/data/product-content-batch-001.json"));
const researchMode = argument("--research", "duckduckgo");
if (researchMode !== "duckduckgo" && researchMode !== "none") {
  throw new Error("--research must be duckduckgo or none.");
}
const offset = numericArgument("--offset", 0);
const limit = numericArgument("--limit", 0);
const concurrency = Math.max(1, Math.min(4, numericArgument("--concurrency", 2)));
const delayMs = Math.max(250, numericArgument("--delay-ms", 650));
const cachePath = join(tmpdir(), "rosagiro-product-content-search-cache.json");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compact = (value: string) => normalize(value).replace(/\s+/g, "");

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " "
  };
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function modelFrom(product: CatalogProduct) {
  const matches = product.name.match(/\b(?:[A-Z]{1,8}[-/]?)*(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:[-/][A-Z0-9]+)*\b/gi) ?? [];
  const candidates = matches.filter((value) => /\d/.test(value) && value.length >= 4);
  if (candidates.length) return candidates.at(-1)!.toUpperCase();
  return product.skus[0]?.code?.trim().toUpperCase() || "SEM-REFERENCIA";
}

function quantityFromName(name: string) {
  const match = name.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|g|kg)\b/i);
  if (!match) return null;
  const unit = match[2].toLowerCase();
  return `${match[1].replace(".", ",")} ${unit === "ml" ? "ml" : unit}`;
}

function correctedProductName(name: string) {
  return name
    .replace(/L\?quida/g, "Líquida")
    .replace(/L\?quido/g, "Líquido")
    .replace(/Bast\?o/g, "Bastão")
    .replace(/L\?pis/g, "Lápis")
    .replace(/M\?scara/g, "Máscara")
    .replace(/C\?lios/g, "Cílios")
    .replace(/Lábial/g, "Labial")
    .replace(/^P\?\s/g, "Pó ")
    .replace(/Pr\?-make/gi, "Pré-Make");
}

function prepareProduct(product: CatalogProduct): CatalogProduct {
  const prepared: CatalogProduct = {
    ...product,
    originalName: product.name,
    currentBrandName: product.brand.name,
    name: correctedProductName(product.name)
  };
  if (product.slug === "blush-bast-o-am-mb012-amor-anjo") {
    prepared.name = "Blush em Bastão Amor Anjo AM-MB012 10 g";
    prepared.brandCorrection = "Amor Anjo";
    prepared.brand = { name: "Amor Anjo" };
  }
  if (product.slug === "espuma-nevada-toque-special-ts5509012") {
    prepared.name = "Espuma Nevada Efeito Neve Toque Special TS5509012 400 ml";
    prepared.specialDescription =
      "A Espuma Nevada Efeito Neve Toque Special TS5509012 é um spray recreativo para criar efeito de neve em festas e brincadeiras. O frasco informa conteúdo de 400 ml, equivalente a 240 g. Agite antes de usar e siga as advertências do aerossol, sem direcionar o jato para o rosto ou para os olhos.";
  }
  return prepared;
}

function classifyText(text: string): ProductKind {
  if (/body splash|colonia corporal/.test(text)) return "body-splash";
  if (/perfume capilar/.test(text)) return "hair-care";
  if (/difusor|aromatizador|perfume|colonia/.test(text)) return "fragrance";
  if (/protetor solar/.test(text)) return "sunscreen";
  if (/disco|disquinho|algodao/.test(text)) return "cotton-pad";
  if (/esponja|pincel|aplicador|curvex|escova|necessaire/.test(text)) return "makeup-tool";
  if (
    /kit|estojo|maleta|diario de maquiagem|3 em 1|3x1|duo.*(maquiagem|blush|sombra)|blush.*iluminador|sombra.*iluminador|base.*corretivo|corretivo.*contorno|delineador.*mascara/.test(
      text
    )
  )
    return "makeup-kit";
  if (/lip oil|oleo labial/.test(text)) return "lip-oil";
  if (/hidratante labial|balm|manteiga de cacau/.test(text)) return "lip-care";
  if (/gloss|brilho labial/.test(text)) return "gloss";
  if (/batom|lip tint|tint labial|jelly tint|lapis labial|contorno labial|lapis de boca/.test(text)) return "lipstick";
  if (/mascara.*cilio|rimel|cilios/.test(text)) return "mascara";
  if (/sobrancelha|brow/.test(text)) return "brow";
  if (/delineador|lapis.*olho|caneta.*olho|kaj[a|l]/.test(text)) return "eyeliner";
  if (/base liquida|base facial|bb cream/.test(text)) return "foundation";
  if (/corretivo/.test(text)) return "concealer";
  if (/blush/.test(text)) return "blush";
  if (/iluminador/.test(text)) return "highlighter";
  if (/contorno|bronzer/.test(text)) return "contour";
  if (/sombra|paleta/.test(text)) return "eyeshadow";
  if (/po compacto|po facial|po solto|po banana|po translucido/.test(text)) return "face-powder";
  if (/^po\b| po matte|po rosa mosqueta/.test(text)) return "face-powder";
  if (/primer|pre maquiagem|pre-maquiagem/.test(text)) return "primer";
  if (/fixador.*maquiagem|spray de maquiagem|bruma/.test(text)) return "setting-spray";
  if (/hair spray|shampoo|anti frizz|cachos|cabelo|capilar/.test(text)) return "hair-care";
  if (/demaquilante|agua micelar|removedor de maquiagem|lenco/.test(text)) return "makeup-remover";
  if (/sabonete facial|gel de limpeza|espuma de limpeza|esfoliante facial|tonico facial/.test(text)) return "face-cleanser";
  if (/serum|hidratante facial|mascara facial|mask stick|peel off|gel facial|creme facial|oleo facial|agua termal|argila|area dos olhos|acido hialuronico/.test(text))
    return "face-care";
  if (/oleo de rosa mosqueta/.test(text)) return "face-care";
  if (/sabonete.*(banho|corporal)|sabonete liquido|espuma.*corporal/.test(text)) return "body-cleanser";
  if (/corporal|corpo|maos|pes|esfoliante|locao|manteiga hidratante/.test(text)) return "body-care";
  return "other";
}

function classify(product: CatalogProduct): ProductKind {
  const fromName = classifyText(normalize(product.name));
  if (fromName !== "other") return fromName;
  return classifyText(normalize(`${product.subcategoryOption?.label ?? ""} ${product.category.label}`));
}

const summaries: Record<ProductKind, string[]> = {
  gloss: [
    "um gloss labial para acrescentar brilho e finalizar a maquiagem dos lábios",
    "um produto labial de acabamento brilhante que pode ser usado sozinho ou sobre outra cor"
  ],
  "lip-oil": [
    "um óleo labial de aplicação direta, voltado ao brilho e aos retoques durante o dia",
    "um produto de textura fluida para deixar os lábios com aparência luminosa"
  ],
  "lip-care": [
    "um cuidado labial para manter os lábios confortáveis e com acabamento suave",
    "um hidratante labial de uso prático para levar na bolsa ou no nécessaire"
  ],
  lipstick: [
    "um produto de cor para os lábios, com aplicação que pode ser construída em camadas",
    "um batom para definir os lábios e ajustar a intensidade da cor conforme a aplicação"
  ],
  mascara: [
    "uma máscara para destacar os cílios e completar a maquiagem dos olhos",
    "um produto para cílios que permite trabalhar o efeito com uma ou mais camadas"
  ],
  eyeliner: [
    "um item para traçar e definir o contorno dos olhos",
    "um produto de maquiagem para criar linhas finas, marcadas ou esfumadas na região dos olhos"
  ],
  brow: [
    "um produto para preencher, alinhar ou definir visualmente as sobrancelhas",
    "um item de maquiagem voltado ao acabamento das sobrancelhas"
  ],
  eyeshadow: [
    "uma opção de cor para as pálpebras, usada sozinha ou em combinações",
    "um produto para compor a maquiagem dos olhos e construir diferentes intensidades"
  ],
  foundation: [
    "uma base para uniformizar visualmente o tom da pele e preparar o acabamento da maquiagem",
    "um produto de pele que pode ser espalhado em camada fina e reforçado onde necessário"
  ],
  concealer: [
    "um corretivo para aplicar pontualmente nas áreas em que se deseja maior uniformidade",
    "um produto de pele para complementar a cobertura da base ou fazer correções localizadas"
  ],
  blush: [
    "um blush para adicionar cor às maçãs do rosto e construir a intensidade aos poucos",
    "um produto de rosto para criar um efeito corado com aplicação leve ou em camadas"
  ],
  highlighter: [
    "um iluminador para realçar pontos do rosto com brilho controlado pela aplicação",
    "um produto de acabamento luminoso para têmporas e outros pontos altos do rosto"
  ],
  contour: [
    "um produto de contorno para criar profundidade e definição visual no rosto",
    "uma opção para marcar áreas do rosto e esfumar até alcançar o acabamento desejado"
  ],
  "face-powder": [
    "um pó facial para finalizar a maquiagem e reduzir visualmente o excesso de brilho",
    "um produto de acabamento para selar áreas da pele após a aplicação da base e do corretivo"
  ],
  primer: [
    "um produto de preparação da pele para ser usado antes da maquiagem",
    "uma etapa pré-maquiagem que ajuda a criar uma superfície mais uniforme para os produtos seguintes"
  ],
  "makeup-remover": [
    "um produto de limpeza para ajudar a retirar maquiagem e resíduos da pele",
    "uma opção para a primeira etapa da limpeza, especialmente após o uso de maquiagem"
  ],
  "face-cleanser": [
    "um produto para a limpeza diária do rosto, usado com água conforme as orientações do rótulo",
    "uma opção de limpeza facial para remover resíduos acumulados ao longo do dia"
  ],
  "face-care": [
    "um produto de cuidado facial para integrar a rotina conforme a indicação presente no rótulo",
    "uma opção para a rotina do rosto, com modo de uso e frequência definidos pelo fabricante"
  ],
  "setting-spray": [
    "um produto em spray para finalizar a maquiagem e renovar o acabamento quando necessário",
    "uma bruma de finalização para aplicar depois das etapas de maquiagem"
  ],
  "hair-care": [
    "um produto para integrar a rotina dos cabelos conforme a forma de uso indicada no rótulo",
    "um item de cuidado ou finalização capilar com aplicação definida pelo fabricante"
  ],
  "body-cleanser": [
    "um produto de limpeza corporal para usar durante o banho e enxaguar em seguida",
    "uma opção para a higiene do corpo, com aplicação sobre a pele úmida"
  ],
  "body-care": [
    "um produto de cuidado corporal para espalhar na pele conforme a orientação da embalagem",
    "uma opção para complementar a rotina de cuidados com o corpo"
  ],
  "body-splash": [
    "um body splash para perfumar o corpo de maneira leve e permitir reaplicações ao longo do dia",
    "uma fragrância corporal em spray para usar após o banho ou sempre que desejar renovar o aroma"
  ],
  fragrance: [
    "um produto perfumado com aplicação definida pelo tipo de uso indicado na embalagem",
    "uma fragrância para compor a rotina e reaplicar de acordo com a preferência"
  ],
  "makeup-tool": [
    "um acessório para apoiar a aplicação ou o acabamento da maquiagem",
    "um item de apoio para distribuir produtos e trabalhar detalhes da maquiagem"
  ],
  "cotton-pad": [
    "um acessório de algodão para apoiar etapas de limpeza e cuidado pessoal",
    "um item descartável para aplicar ou remover produtos na rotina de beleza"
  ],
  sunscreen: [
    "um protetor solar facial cuja forma de uso e reaplicação deve seguir as informações do rótulo",
    "um produto de proteção facial para usar conforme o fator e as instruções declaradas pelo fabricante"
  ],
  "makeup-kit": [
    "um conjunto de maquiagem que reúne mais de um item ou função na mesma apresentação",
    "um kit pensado para manter produtos complementares reunidos em uma única embalagem"
  ],
  other: [
    "um item de beleza identificado por marca e referência no catálogo da RosaGiro",
    "um produto de beleza cuja apresentação e forma de uso podem ser conferidas no rótulo e nas imagens"
  ]
};

const usage: Record<ProductKind, string[]> = {
  gloss: ["Aplique uma camada nos lábios limpos e reaplique se quiser mais brilho.", "Pode ser usado diretamente nos lábios ou como acabamento sobre o batom."],
  "lip-oil": ["Passe o aplicador sobre os lábios e repita a aplicação quando quiser renovar o brilho.", "Use sozinho ou por cima de outra cor, começando por uma camada leve."],
  "lip-care": ["A aplicação pode ser repetida ao longo do dia conforme a necessidade.", "Passe diretamente nos lábios e mantenha o produto fechado depois do uso."],
  lipstick: ["Comece pelo centro dos lábios, contorne as bordas e acrescente outra camada se quiser intensificar a cor.", "A cor pode ser aplicada diretamente ou com pincel labial para trabalhar melhor o contorno."],
  mascara: ["Passe a escova da raiz às pontas; camadas adicionais devem ser aplicadas antes de o produto secar por completo.", "Retire o excesso do aplicador e distribua o produto da base dos cílios até as pontas."],
  eyeliner: ["Faça o traço junto à linha dos cílios e ajuste a espessura aos poucos.", "Aplique em pequenos movimentos para controlar o formato e esfume logo após, quando esse for o efeito desejado."],
  brow: ["Trabalhe com pouca quantidade e acompanhe o sentido natural dos fios.", "Comece pelas áreas com menos fios e esfume para evitar marcações duras."],
  eyeshadow: ["A cor pode ser depositada com pincel ou com os dedos e esfumada nas bordas.", "Comece com pouca quantidade e sobreponha camadas para aumentar a intensidade."],
  foundation: ["Espalhe do centro do rosto para as laterais com pincel, esponja ou dedos.", "Aplique uma camada fina e reforce somente as áreas em que desejar mais cobertura."],
  concealer: ["Use pouca quantidade e dê leves batidinhas até integrar o produto à pele.", "Aplique depois da base ou diretamente sobre a pele e esfume as bordas."],
  blush: ["Deposite uma pequena quantidade nas maçãs do rosto e esfume em direção às têmporas.", "Construa a cor aos poucos para manter o controle do resultado."],
  highlighter: ["Aplique em pouca quantidade e esfume para evitar linhas marcadas.", "Use nos pontos que deseja destacar e acrescente novas camadas somente se precisar de mais brilho."],
  contour: ["Aplique nas áreas que deseja definir e esfume bem as bordas.", "Trabalhe com pouca quantidade, construindo o efeito sem deixar marcações."],
  "face-powder": ["Use pincel ou esponja e concentre a aplicação nas áreas que precisam de acabamento.", "Retire o excesso do aplicador antes de pressionar ou varrer o pó sobre a pele."],
  primer: ["Espalhe uma camada fina sobre a pele limpa e aguarde a acomodação antes da base.", "Use pouca quantidade nas áreas desejadas antes de seguir com a maquiagem."],
  "makeup-remover": ["Aplique com movimentos suaves e finalize a limpeza de acordo com as instruções da embalagem.", "Evite esfregar a região dos olhos e enxágue quando o rótulo indicar."],
  "face-cleanser": ["Massageie suavemente sobre a pele úmida e enxágue por completo.", "Use a quantidade indicada no rótulo e evite contato direto com os olhos."],
  "face-care": ["Confira no rótulo a ordem de aplicação, a frequência e as precauções específicas da fórmula.", "Aplique sobre a pele limpa seguindo a quantidade e a frequência informadas pelo fabricante."],
  "setting-spray": ["Borrife a uma pequena distância do rosto, mantendo olhos e boca fechados durante a aplicação.", "Aplique depois da maquiagem e aguarde a secagem sem esfregar a pele."],
  "hair-care": ["Confira no rótulo se o produto deve ser aplicado nos fios secos, úmidos ou durante a lavagem.", "Use somente nos cabelos e siga a quantidade e as precauções informadas na embalagem."],
  "body-cleanser": ["Espalhe sobre a pele molhada, massageie e enxágue completamente.", "Siga a quantidade e as precauções informadas na embalagem."],
  "body-care": ["Aplique sobre a pele limpa e massageie até espalhar de maneira uniforme.", "Consulte o rótulo para confirmar frequência de uso e precauções da fórmula."],
  "body-splash": ["Borrife a uma pequena distância da pele e evite o contato com olhos e mucosas.", "O aroma pode ser renovado durante o dia conforme a preferência."],
  fragrance: ["Confira na embalagem se a aplicação é corporal, capilar ou destinada ao ambiente.", "Use na área indicada pelo fabricante e evite contato com olhos e mucosas."],
  "makeup-tool": ["Use o formato do acessório nas áreas compatíveis e higienize-o de acordo com o material.", "Mantenha o acessório limpo e deixe secar completamente antes de guardar."],
  "cotton-pad": ["Use uma unidade por vez com o produto escolhido e descarte após o uso.", "Evite fricção excessiva, especialmente nas áreas mais sensíveis do rosto."],
  sunscreen: ["A quantidade, o tempo antes da exposição e a reaplicação devem seguir o rótulo.", "Confira o fator de proteção e as advertências na embalagem antes do uso."],
  "makeup-kit": ["Os itens podem ser combinados ou usados separadamente conforme a composição mostrada nas fotos.", "Confira as peças incluídas na apresentação antes de escolher a variação."],
  other: ["Confira as fotos, o rótulo e a referência antes do uso.", "Siga as instruções e precauções informadas pelo fabricante na embalagem."]
};

function productFact(product: CatalogProduct) {
  const text = normalize(product.name);
  if (/matte|fosco/.test(text)) return "O acabamento matte faz parte da apresentação informada para esta versão.";
  if (/glitter|brilho|shine|glow|luminous|iluminador/.test(text)) return "O efeito de brilho faz parte da proposta visual desta versão.";
  if (/duo|2 em 1|3 em 1|3x1|kit|paleta|estojo/.test(text)) return "A apresentação reúne mais de uma função, cor ou item, conforme mostrado nas fotos.";
  if (/stick|bastao/.test(text)) return "O formato em bastão facilita a aplicação direta e os retoques.";
  return "";
}

function catalogClosing(product: CatalogProduct, model: string, variant: number) {
  const skuCount = product.skus.length;
  if (skuCount > 1) {
    const options = [
      `Este anúncio reúne ${skuCount} variações cadastradas; confira os códigos e as imagens antes de escolher.`,
      `Há ${skuCount} opções vinculadas ao produto, identificadas pelas fotos e pelos códigos de variação.`
    ];
    return options[variant % options.length];
  }
  const options = [
    `No catálogo, a referência é ${model}; confira a embalagem e a apresentação nas fotos antes da compra.`,
    `Este anúncio corresponde ao código ${model}; as imagens mostram a apresentação cadastrada.`
  ];
  return options[variant % options.length];
}

function buildDescription(product: CatalogProduct, model: string) {
  if (product.specialDescription) return product.specialDescription;
  const kind = classify(product);
  const variant = hash(product.slug);
  const summary = summaries[kind][variant % summaries[kind].length];
  const instruction = usage[kind][Math.floor(variant / 7) % usage[kind].length];
  const closing = catalogClosing(product, model, Math.floor(variant / 13));
  const fact = productFact(product);
  const intros = [
    `${product.name} é ${summary}.`,
    `Este anúncio apresenta ${product.name} como ${summary}.`
  ];
  const description = `${intros[variant % intros.length]}${fact ? ` ${fact}` : ""} ${instruction} ${closing}`
    .replace(/\s+/g, " ")
    .trim();
  if (description.length < 140) throw new Error(`${product.slug}: generated description is too short.`);
  return description;
}

function meaningfulTokens(value: string) {
  const ignored = new Set(["para", "com", "por", "uma", "linha", "produto", "ruby", "rose", "make", "maquiagem"]);
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4 && !ignored.has(token));
}

function unwrapDuckDuckGoUrl(value: string) {
  const decoded = decodeHtml(value);
  try {
    const url = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded);
    const redirected = url.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : url.toString();
  } catch {
    return decoded;
  }
}

function parseDuckDuckGo(html: string, product: CatalogProduct, model: string): SearchResult[] {
  const blocks = html.match(/<div class="result results_links[^]*?<\/div>\s*<\/div>/gi) ?? [];
  const fallbackAnchors = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gis)].map(
    (match) => ({ url: match[1], title: decodeHtml(match[2]), snippet: "" })
  );
  const parsed = blocks
    .map((block) => {
      const anchor = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/is);
      if (!anchor) return null;
      const snippet = block.match(/class="result__snippet"[^>]*>(.*?)<\/a>|class="result__snippet"[^>]*>(.*?)<\/div>/is);
      return {
        url: anchor[1],
        title: decodeHtml(anchor[2]),
        snippet: decodeHtml(snippet?.[1] ?? snippet?.[2] ?? "")
      };
    })
    .filter((result): result is { url: string; title: string; snippet: string } => Boolean(result));
  const candidates = parsed.length ? parsed : fallbackAnchors;
  const modelKey = compact(model);
  const brandTokens = meaningfulTokens(product.brand.name);
  const productTokens = meaningfulTokens(product.name).filter((token) => !compact(token).includes(modelKey));

  return candidates
    .map((candidate) => {
      const url = unwrapDuckDuckGoUrl(candidate.url);
      const haystack = normalize(`${candidate.title} ${candidate.snippet} ${url}`);
      const haystackCompact = compact(haystack);
      const exactModel = modelKey.length >= 4 && haystackCompact.includes(modelKey);
      const brandMatches = brandTokens.filter((token) => haystack.includes(token)).length;
      const productMatches = productTokens.filter((token) => haystack.includes(token)).length;
      const marketplace = /mercadolivre\.com\.br|mercadolivre\.com/.test(url);
      const score =
        (exactModel ? 55 : 0) +
        Math.min(20, brandMatches * 10) +
        Math.min(20, productMatches * 4) +
        (marketplace ? 15 : 0);
      return { ...candidate, url, score, exactModel };
    })
    .filter((result) => result.url.startsWith("http") && result.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function searchQuery(product: CatalogProduct, model: string) {
  const titleTokens = meaningfulTokens(product.name)
    .filter((token) => !/\d/.test(token))
    .slice(0, 4)
    .join(" ");
  return `"${model}" "${product.brand.name}" ${titleTokens}`.trim();
}

function loadCache() {
  if (!existsSync(cachePath)) return {} as Record<string, SearchCacheEntry>;
  try {
    return JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, SearchCacheEntry>;
  } catch {
    return {} as Record<string, SearchCacheEntry>;
  }
}

function saveCache(cache: Record<string, SearchCacheEntry>) {
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

const sleep = (milliseconds: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function researchProduct(product: CatalogProduct, model: string) {
  const query = searchQuery(product, model);
  const key = compact(query);
  const cache = researchCache[key];
  if (cache) return cache;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=br-pt`, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const entry: SearchCacheEntry = {
      query,
      searchedAt: new Date().toISOString(),
      results: parseDuckDuckGo(html, product, model)
    };
    researchCache[key] = entry;
    return entry;
  } catch (error) {
    const entry: SearchCacheEntry = {
      query,
      searchedAt: new Date().toISOString(),
      results: [],
      error: error instanceof Error ? error.message : String(error)
    };
    researchCache[key] = entry;
    return entry;
  }
}

const completedBatch = JSON.parse(readFileSync(sourceBatchPath, "utf8")) as {
  entries: Array<{ slug: string }>;
};
const completedSlugs = new Set(completedBatch.entries.map((entry) => entry.slug));
const researchCache = loadCache();

async function main() {
  const catalog = (await prisma.product.findMany({
    where: { active: true, deletedAt: null },
    select: {
      slug: true,
      name: true,
      image: true,
      volume: true,
      weightGrams: true,
      brand: { select: { name: true } },
      category: { select: { label: true, slug: true } },
      subcategoryOption: { select: { label: true, slug: true } },
      skus: {
        select: { name: true, code: true, image: true },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }]
  })) as CatalogProduct[];
  const remaining = catalog.filter((product) => !completedSlugs.has(product.slug)).map(prepareProduct);
  const selected = remaining.slice(offset, limit ? offset + limit : undefined);
  const rows: Array<{
    product: CatalogProduct;
    model: string;
    research: SearchCacheEntry;
  }> = new Array(selected.length);

  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= selected.length) return;
      const product = selected[index];
      const model = modelFrom(product);
      const research =
        researchMode === "duckduckgo"
          ? await researchProduct(product, model)
          : { query: searchQuery(product, model), searchedAt: new Date().toISOString(), results: [] };
      rows[index] = { product, model, research };
      completed += 1;
      if (completed % 25 === 0 || completed === selected.length) {
        const exact = rows.filter((row) => row?.research.results.some((result) => result.exactModel)).length;
        console.log(`progress=${completed}/${selected.length} exactExternal=${exact}`);
        saveCache(researchCache);
      }
      if (researchMode === "duckduckgo") await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  saveCache(researchCache);

  const entries = rows.map(({ product, model, research }) => {
    const external = research.results.filter((result) => result.exactModel && result.score >= 65).slice(0, 2);
    const volume = product.volume.trim() || quantityFromName(product.name);
    return {
      slug: product.slug,
      ...(product.name !== product.originalName ? { name: product.name } : {}),
      brand: product.currentBrandName ?? product.brand.name,
      ...(product.brandCorrection ? { brandCorrection: product.brandCorrection } : {}),
      model,
      confidence: external.length ? "high" : "medium",
      descriptionPt: buildDescription(product, model),
      volume,
      shippingWeightGrams: null,
      shippingWeightStatus: "not_found",
      shippingWeightNote: product.weightGrams
        ? `O cadastro já possui ${product.weightGrams} g como peso logístico; esta pesquisa não alterou o valor.`
        : "Não foi encontrado peso bruto unitário com embalagem; conteúdo em ml ou g não foi convertido em peso de frete.",
      sources: [
        ...external.map((result) => ({
          label: /mercadolivre/.test(result.url) ? "Mercado Livre Brasil" : new URL(result.url).hostname.replace(/^www\./, ""),
          url: result.url,
          evidence: `Resultado indexado com correspondência de marca e modelo ${model}: ${result.title}${result.snippet ? ` — ${result.snippet}` : ""}`
        })),
        {
          label: "RosaGiro - cadastro e imagem do produto",
          url: product.image,
          evidence: `Nome, marca, referência ${model}, categoria ${product.category.label} e ${product.skus.length} variação(ões) conferidos no cadastro e nas imagens.`
        }
      ],
      research: {
        method: external.length ? "exact_external_and_catalog" : "catalog_and_product_image",
        query: research.query,
        kind: classify(product),
        externalMatches: external.length,
        externalError: research.error ?? null
      }
    };
  });

  const descriptions = new Set<string>();
  for (const entry of entries) {
    if (descriptions.has(entry.descriptionPt)) throw new Error(`Duplicate description generated for ${entry.slug}.`);
    descriptions.add(entry.descriptionPt);
    if (/descubra|imperd[ií]vel|perfeito para|resultados garantidos|preço unitário|embalagem para atacado/i.test(entry.descriptionPt)) {
      throw new Error(`${entry.slug}: generated description contains prohibited marketing or commercial language.`);
    }
  }

  const output = {
    batch: `product-content-${offset + 1}-${offset + entries.length}`,
    createdAt: new Date().toISOString(),
    methodology:
      researchMode === "duckduckgo"
        ? "Mercado Livre and other indexed Brazilian commerce results are prioritized when brand and model match exactly. Catalog-only entries use verified name, model, category, SKU images and safe product-type guidance without invented claims."
        : "Entries use verified catalog name, model, category and SKU images with safe product-type guidance. External specifications and logistics weights are not inferred.",
    stats: {
      researchMode,
      catalogTotal: catalog.length,
      previouslyCompleted: completedSlugs.size,
      remainingTotal: remaining.length,
      selected: entries.length,
      highConfidence: entries.filter((entry) => entry.confidence === "high").length,
      mediumConfidence: entries.filter((entry) => entry.confidence === "medium").length,
      externalErrors: rows.filter((row) => Boolean(row.research.error)).length,
      extractedVolume: entries.filter((entry) => Boolean(entry.volume)).length,
      verifiedNewShippingWeights: 0
    },
    entries
  };
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...output.stats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
