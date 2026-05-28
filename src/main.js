const categories = [
  { id: "skincare", label: "Skincare", note: "Limpeza, tratamento e protecao diaria" },
  { id: "makeup", label: "Maquiagem", note: "Cor, acabamento e longa duracao" },
  { id: "fragrance", label: "Perfumes", note: "Assinaturas leves, florais e amadeiradas" },
  { id: "body", label: "Corpo", note: "Hidratacao, banho e cuidado sensorial" },
  { id: "hair", label: "Cabelos", note: "Rotinas para brilho, cachos e reparacao" },
  { id: "tools", label: "Acessorios", note: "Pinceis, necessaires e ferramentas" }
];

const brands = [
  {
    id: "auralab",
    name: "AuraLab",
    logo: "AL",
    origin: "Sao Paulo, Brasil",
    descriptionPt: "Skincare de textura leve para rotinas urbanas.",
    featured: true,
    categories: ["skincare", "body"]
  },
  {
    id: "nativa-cura",
    name: "Nativa Cura",
    logo: "NC",
    origin: "Curitiba, Brasil",
    descriptionPt: "Formulas botanicas com toque profissional.",
    featured: true,
    categories: ["skincare", "hair"]
  },
  {
    id: "velvet-rua",
    name: "Velvet Rua",
    logo: "VR",
    origin: "Rio de Janeiro, Brasil",
    descriptionPt: "Maquiagem sofisticada para pele real.",
    featured: true,
    categories: ["makeup"]
  },
  {
    id: "casa-figo",
    name: "Casa Figo",
    logo: "CF",
    origin: "Belo Horizonte, Brasil",
    descriptionPt: "Fragrancias de banho e perfume para todos os dias.",
    featured: false,
    categories: ["fragrance", "body"]
  },
  {
    id: "linha-lume",
    name: "Linha Lume",
    logo: "LL",
    origin: "Florianopolis, Brasil",
    descriptionPt: "Cuidado capilar com finalizacao limpa e brilhante.",
    featured: false,
    categories: ["hair", "tools"]
  }
];

const products = [
  {
    id: "aura-serum-c",
    brand: "AuraLab",
    name: "Serum C Aura 12%",
    category: "skincare",
    subcategory: "Tratamentos",
    priceBRL: 149.9,
    compareAtPriceBRL: 179.9,
    image: "/assets/products/aura-serum.svg",
    gallery: ["/assets/products/aura-serum.svg"],
    descriptionPt: "Serum antioxidante de toque seco para luminosidade e tom mais uniforme.",
    benefits: ["Ilumina sem pesar", "Textura rapida", "Bom sob protetor solar"],
    ingredients: ["Vitamina C", "Ferulico", "Niacinamida"],
    skinType: "Todos os tipos",
    finish: "Natural luminoso",
    volume: "30 ml",
    rating: 4.8,
    reviewCount: 214,
    stockStatus: "Em estoque",
    badges: ["Mais vendido", "Novo"]
  },
  {
    id: "nativa-gel-limpeza",
    brand: "Nativa Cura",
    name: "Gel de Limpeza Equilibrio",
    category: "skincare",
    subcategory: "Limpeza",
    priceBRL: 82.5,
    compareAtPriceBRL: null,
    image: "/assets/products/nativa-cleanser.svg",
    gallery: ["/assets/products/nativa-cleanser.svg"],
    descriptionPt: "Limpeza suave para remover oleosidade sem sensacao repuxada.",
    benefits: ["pH gentil", "Nao resseca", "Uso diario"],
    ingredients: ["Cha verde", "Pantenol", "Glicerina"],
    skinType: "Mista e oleosa",
    finish: "Pele fresca",
    volume: "150 ml",
    rating: 4.7,
    reviewCount: 168,
    stockStatus: "Em estoque",
    badges: ["Derm-friendly"]
  },
  {
    id: "velvet-balm",
    brand: "Velvet Rua",
    name: "Balm Tinto Rosa Veludo",
    category: "makeup",
    subcategory: "Labios",
    priceBRL: 69.9,
    compareAtPriceBRL: 89.9,
    image: "/assets/products/velvet-balm.svg",
    gallery: ["/assets/products/velvet-balm.svg"],
    descriptionPt: "Balm pigmentado com brilho confortavel e cor construivel.",
    benefits: ["Conforto imediato", "Cor modulavel", "Bolsa essencial"],
    ingredients: ["Manteiga de karite", "Oleo de jojoba", "Vitamina E"],
    skinType: "Todos os tipos",
    finish: "Glow suave",
    volume: "4 g",
    rating: 4.6,
    reviewCount: 91,
    stockStatus: "Em estoque",
    badges: ["Oferta"]
  },
  {
    id: "solar-mist-fps",
    brand: "AuraLab",
    name: "Bruma Solar FPS 50",
    category: "skincare",
    subcategory: "Protecao solar",
    priceBRL: 119.9,
    compareAtPriceBRL: null,
    image: "/assets/products/solar-mist.svg",
    gallery: ["/assets/products/solar-mist.svg"],
    descriptionPt: "Protetor em bruma para reaplicar ao longo do dia, inclusive sobre maquiagem.",
    benefits: ["Reaplicacao facil", "Acabamento invisivel", "Bolsa e praia"],
    ingredients: ["Filtros UVA/UVB", "Aloe vera", "Bisabolol"],
    skinType: "Todos os tipos",
    finish: "Invisivel",
    volume: "75 ml",
    rating: 4.5,
    reviewCount: 132,
    stockStatus: "Em estoque",
    badges: ["FPS 50"]
  },
  {
    id: "flora-blush",
    brand: "Velvet Rua",
    name: "Blush Creme Flora",
    category: "makeup",
    subcategory: "Face",
    priceBRL: 94.9,
    compareAtPriceBRL: null,
    image: "/assets/products/flora-blush.svg",
    gallery: ["/assets/products/flora-blush.svg"],
    descriptionPt: "Blush cremoso de acabamento natural para um rubor fresco.",
    benefits: ["Esfuma facil", "Nao marca textura", "Multifuncional"],
    ingredients: ["Esqualano", "Pigmentos minerais", "Cera vegetal"],
    skinType: "Todos os tipos",
    finish: "Viçoso",
    volume: "6 g",
    rating: 4.9,
    reviewCount: 77,
    stockStatus: "Em estoque",
    badges: ["Favorito"]
  },
  {
    id: "noite-lipstick",
    brand: "Velvet Rua",
    name: "Batom Noite de Seda",
    category: "makeup",
    subcategory: "Labios",
    priceBRL: 76.9,
    compareAtPriceBRL: null,
    image: "/assets/products/noite-lip.svg",
    gallery: ["/assets/products/noite-lip.svg"],
    descriptionPt: "Batom satin com pigmento intenso e conforto de longa duracao.",
    benefits: ["Alta pigmentacao", "Nao craquela", "Cor sofisticada"],
    ingredients: ["Oleo de ameixa", "Cera de arroz", "Vitamina E"],
    skinType: "Todos os tipos",
    finish: "Satin",
    volume: "3,5 g",
    rating: 4.6,
    reviewCount: 64,
    stockStatus: "Em estoque",
    badges: ["Novo"]
  },
  {
    id: "bruma-figo",
    brand: "Casa Figo",
    name: "Bruma Perfumada Figo Verde",
    category: "fragrance",
    subcategory: "Body splash",
    priceBRL: 98.0,
    compareAtPriceBRL: 118.0,
    image: "/assets/products/bruma-figo.svg",
    gallery: ["/assets/products/bruma-figo.svg"],
    descriptionPt: "Bruma fresca com notas de figo, folhas verdes e musk limpo.",
    benefits: ["Leve para o dia", "Camadas com hidratante", "Sem excesso"],
    ingredients: ["Figo verde", "Musk", "Cedro claro"],
    skinType: "Todos os tipos",
    finish: "Fresco",
    volume: "120 ml",
    rating: 4.7,
    reviewCount: 103,
    stockStatus: "Em estoque",
    badges: ["Oferta"]
  },
  {
    id: "madeira-eau",
    brand: "Casa Figo",
    name: "Eau de Parfum Madeira Clara",
    category: "fragrance",
    subcategory: "Perfume",
    priceBRL: 229.9,
    compareAtPriceBRL: null,
    image: "/assets/products/madeira-eau.svg",
    gallery: ["/assets/products/madeira-eau.svg"],
    descriptionPt: "Assinatura amadeirada limpa com abertura citrica e fundo cremoso.",
    benefits: ["Elegante", "Boa fixacao", "Unissex"],
    ingredients: ["Bergamota", "Sandalwood", "Ambrox"],
    skinType: "Todos os tipos",
    finish: "Amadeirado limpo",
    volume: "50 ml",
    rating: 4.8,
    reviewCount: 58,
    stockStatus: "Em estoque",
    badges: ["Premium"]
  },
  {
    id: "corpo-amendoa",
    brand: "AuraLab",
    name: "Creme Corpo Amendoa Clara",
    category: "body",
    subcategory: "Hidratantes",
    priceBRL: 109.9,
    compareAtPriceBRL: null,
    image: "/assets/products/corpo-amendoa.svg",
    gallery: ["/assets/products/corpo-amendoa.svg"],
    descriptionPt: "Hidratante corporal de absorcao rapida com perfume macio.",
    benefits: ["Pele macia", "Nao mela", "Perfume elegante"],
    ingredients: ["Oleo de amendoa", "Ceramidas", "Manteiga de cupuacu"],
    skinType: "Normal a seca",
    finish: "Aveludado",
    volume: "220 ml",
    rating: 4.7,
    reviewCount: 145,
    stockStatus: "Em estoque",
    badges: ["Corpo"]
  },
  {
    id: "cachos-oleo",
    brand: "Linha Lume",
    name: "Oleo Cachos Luminosos",
    category: "hair",
    subcategory: "Finalizadores",
    priceBRL: 88.9,
    compareAtPriceBRL: 105.9,
    image: "/assets/products/cachos-oleo.svg",
    gallery: ["/assets/products/cachos-oleo.svg"],
    descriptionPt: "Oleo leve para selar pontas, reduzir frizz e dar brilho.",
    benefits: ["Brilho imediato", "Controle de frizz", "Nao pesa"],
    ingredients: ["Oleo de pracaxi", "Argan", "Vitamina E"],
    skinType: "Cabelos cacheados e ondulados",
    finish: "Brilho natural",
    volume: "60 ml",
    rating: 4.8,
    reviewCount: 121,
    stockStatus: "Em estoque",
    badges: ["Cachos"]
  },
  {
    id: "pincel-precisao",
    brand: "Linha Lume",
    name: "Pincel Precisao Duo",
    category: "tools",
    subcategory: "Pinceis",
    priceBRL: 54.9,
    compareAtPriceBRL: null,
    image: "/assets/products/pincel-precisao.svg",
    gallery: ["/assets/products/pincel-precisao.svg"],
    descriptionPt: "Pincel duo para corretivo, iluminador e pequenos detalhes.",
    benefits: ["Cerdas macias", "Corte preciso", "Facil de lavar"],
    ingredients: ["Cerdas sinteticas", "Cabo reciclado"],
    skinType: "Todos os tipos",
    finish: "Precisao",
    volume: "1 unidade",
    rating: 4.5,
    reviewCount: 49,
    stockStatus: "Em estoque",
    badges: ["Acessorio"]
  },
  {
    id: "necessaire-viagem",
    brand: "Bela Viva",
    name: "Necessaire Curadoria",
    category: "tools",
    subcategory: "Organizacao",
    priceBRL: 72.0,
    compareAtPriceBRL: null,
    image: "/assets/products/necessaire.svg",
    gallery: ["/assets/products/necessaire.svg"],
    descriptionPt: "Necessaire resistente para organizar rotina de bolsa, academia ou viagem.",
    benefits: ["Compacta", "Forro lavavel", "Cabe produtos full size"],
    ingredients: ["Nylon premium", "Forro impermeavel"],
    skinType: "Todos os tipos",
    finish: "Organizacao",
    volume: "1 unidade",
    rating: 4.6,
    reviewCount: 36,
    stockStatus: "Em estoque",
    badges: ["Bela Viva"]
  }
];

const state = {
  route: parseRoute(),
  cart: loadCart(),
  filters: { category: "all", brand: "all", sort: "featured", query: "" },
  checkout: null
};

const app = document.querySelector("#app");

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value || 0);
}

function parseRoute() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!parts.length) return { name: "home" };
  if (parts[0] === "categoria") return { name: "catalog", category: parts[1] || "all" };
  if (parts[0] === "produto") return { name: "product", id: parts[1] };
  if (["carrinho", "checkout", "confirmacao"].includes(parts[0])) return { name: parts[0] };
  return { name: "home" };
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("bela-viva-cart") || "[]");
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("bela-viva-cart", JSON.stringify(state.cart));
}

function cartItems() {
  return state.cart
    .map((item) => ({ ...item, product: products.find((product) => product.id === item.id) }))
    .filter((item) => item.product);
}

function cartCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function subtotal() {
  return cartItems().reduce((sum, item) => sum + item.product.priceBRL * item.qty, 0);
}

function discount() {
  return subtotal() >= 250 ? subtotal() * 0.1 : 0;
}

function shippingCost(method = "padrao") {
  if (subtotal() >= 299) return 0;
  return method === "expressa" ? 24.9 : 14.9;
}

function total(method) {
  return subtotal() - discount() + shippingCost(method);
}

function categoryLabel(id) {
  return categories.find((category) => category.id === id)?.label || "Todos";
}

function pageShell(content) {
  return `
    <header class="topbar">
      <a class="brand" href="#/">
        <span class="brand-mark">BV</span>
        <span>
          <strong>Bela Viva</strong>
          <small>beleza multimarcas</small>
        </span>
      </a>
      <nav class="desktop-nav" aria-label="Categorias">
        ${categories
          .slice(0, 5)
          .map((category) => `<a href="#/categoria/${category.id}">${category.label}</a>`)
          .join("")}
      </nav>
      <a class="cart-link" href="#/carrinho" aria-label="Abrir carrinho">
        <span class="cart-icon">Bag</span>
        <span class="cart-count">${cartCount()}</span>
      </a>
    </header>
    <main>${content}</main>
    <nav class="mobile-tabs" aria-label="Navegacao principal">
      <a href="#/">Inicio</a>
      <a href="#/categoria/all">Categorias</a>
      <a href="#/carrinho">Carrinho <span>${cartCount()}</span></a>
    </nav>
  `;
}

function homePage() {
  const heroProduct = products[0];
  return pageShell(`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Curadoria brasileira de beleza</p>
        <h1>Rotinas completas, marcas selecionadas e compra simples.</h1>
        <p>
          Um prototipo de loja multimarcas para descobrir skincare, maquiagem,
          perfumes e cuidados com entrega pensada para o Brasil.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#/categoria/all">Comprar curadoria</a>
          <a class="button secondary" href="#/produto/${heroProduct.id}">Ver destaque</a>
        </div>
      </div>
      <a class="hero-product" href="#/produto/${heroProduct.id}" aria-label="Produto em destaque">
        <img src="${heroProduct.image}" alt="${heroProduct.name}" />
        <span>${heroProduct.brand}</span>
        <strong>${heroProduct.name}</strong>
        <small>${money(heroProduct.priceBRL)}</small>
      </a>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Categorias</p>
        <h2>Compre por ritual</h2>
      </div>
      <div class="category-grid">
        ${categories
          .map(
            (category) => `
              <a class="category-tile" href="#/categoria/${category.id}">
                <span>${category.label}</span>
                <small>${category.note}</small>
              </a>
            `
          )
          .join("")}
      </div>
    </section>

    <section class="section split-band">
      <div>
        <p class="eyebrow">Marcas em destaque</p>
        <h2>Selecionadas por textura, acabamento e rotina real.</h2>
      </div>
      <div class="brand-row">
        ${brands
          .filter((brand) => brand.featured)
          .map(
            (brand) => `
              <button class="brand-chip" data-brand="${brand.name}">
                <span>${brand.logo}</span>
                <strong>${brand.name}</strong>
                <small>${brand.origin}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Mais desejados</p>
        <h2>Produtos para testar o fluxo</h2>
      </div>
      <div class="product-grid">
        ${products.slice(0, 8).map(productCard).join("")}
      </div>
    </section>
  `);
}

function catalogPage(initialCategory = "all") {
  state.filters.category = initialCategory || state.filters.category;
  const list = filteredProducts();
  return pageShell(`
    <section class="catalog-header">
      <p class="eyebrow">Catalogo</p>
      <h1>${state.filters.category === "all" ? "Todas as categorias" : categoryLabel(state.filters.category)}</h1>
      <p>${list.length} produtos no prototipo, com filtros por categoria, marca e prioridade de compra.</p>
    </section>

    <section class="catalog-layout">
      <aside class="filters" aria-label="Filtros de catalogo">
        <label>
          Buscar
          <input data-filter="query" value="${escapeHtml(state.filters.query)}" placeholder="Serum, batom, perfume..." />
        </label>
        <label>
          Categoria
          <select data-filter="category">
            <option value="all">Todas</option>
            ${categories
              .map(
                (category) =>
                  `<option value="${category.id}" ${category.id === state.filters.category ? "selected" : ""}>${category.label}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          Marca
          <select data-filter="brand">
            <option value="all">Todas</option>
            ${brands
              .map(
                (brand) =>
                  `<option value="${brand.name}" ${brand.name === state.filters.brand ? "selected" : ""}>${brand.name}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          Ordenar
          <select data-filter="sort">
            <option value="featured" ${state.filters.sort === "featured" ? "selected" : ""}>Curadoria</option>
            <option value="price-asc" ${state.filters.sort === "price-asc" ? "selected" : ""}>Menor preco</option>
            <option value="price-desc" ${state.filters.sort === "price-desc" ? "selected" : ""}>Maior preco</option>
            <option value="rating" ${state.filters.sort === "rating" ? "selected" : ""}>Melhor avaliacao</option>
          </select>
        </label>
      </aside>
      <div>
        <div class="category-pills">
          <button data-category="all" class="${state.filters.category === "all" ? "active" : ""}">Tudo</button>
          ${categories
            .map(
              (category) =>
                `<button data-category="${category.id}" class="${state.filters.category === category.id ? "active" : ""}">${category.label}</button>`
            )
            .join("")}
        </div>
        <div class="product-grid">
          ${list.length ? list.map(productCard).join("") : emptyState("Nenhum produto encontrado", "Tente limpar filtros ou buscar outro termo.")}
        </div>
      </div>
    </section>
  `);
}

function productPage(id) {
  const product = products.find((item) => item.id === id) || products[0];
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  return pageShell(`
    <section class="product-detail">
      <div class="product-media">
        <img src="${product.image}" alt="${product.name}" />
      </div>
      <div class="product-info">
        <a class="back-link" href="#/categoria/${product.category}">Voltar para ${categoryLabel(product.category)}</a>
        <p class="eyebrow">${product.brand} / ${product.subcategory}</p>
        <h1>${product.name}</h1>
        <div class="rating">★ ${product.rating.toFixed(1)} <span>(${product.reviewCount} avaliacoes)</span></div>
        <p class="description">${product.descriptionPt}</p>
        <div class="price-line">
          <strong>${money(product.priceBRL)}</strong>
          ${product.compareAtPriceBRL ? `<span>${money(product.compareAtPriceBRL)}</span>` : ""}
        </div>
        <div class="badge-row">${product.badges.map((badge) => `<span>${badge}</span>`).join("")}</div>
        <button class="button primary wide" data-add="${product.id}">Adicionar ao carrinho</button>
        <dl class="spec-list">
          <div><dt>Tipo</dt><dd>${product.skinType}</dd></div>
          <div><dt>Acabamento</dt><dd>${product.finish}</dd></div>
          <div><dt>Volume</dt><dd>${product.volume}</dd></div>
          <div><dt>Status</dt><dd>${product.stockStatus}</dd></div>
        </dl>
      </div>
    </section>

    <section class="section detail-columns">
      <div>
        <h2>Beneficios</h2>
        <ul>${product.benefits.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div>
        <h2>Ingredientes-chave</h2>
        <ul>${product.ingredients.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Complete a rotina</p>
        <h2>Tambem nesta categoria</h2>
      </div>
      <div class="product-grid compact">
        ${related.map(productCard).join("")}
      </div>
    </section>
  `);
}

function cartPage() {
  const items = cartItems();
  return pageShell(`
    <section class="checkout-shell">
      <div class="cart-panel">
        <p class="eyebrow">Carrinho</p>
        <h1>Sua selecao</h1>
        ${
          items.length
            ? items.map(cartRow).join("")
            : emptyState("Seu carrinho esta vazio", "Explore categorias e adicione produtos para testar o fluxo.")
        }
      </div>
      <aside class="summary-panel">
        ${summaryBlock()}
        <a class="button primary wide ${items.length ? "" : "disabled"}" href="${items.length ? "#/checkout" : "#/categoria/all"}">
          ${items.length ? "Continuar para checkout" : "Ver produtos"}
        </a>
      </aside>
    </section>
  `);
}

function checkoutPage() {
  if (!cartItems().length) {
    window.location.hash = "#/carrinho";
    return "";
  }
  return pageShell(`
    <section class="checkout-shell">
      <form class="checkout-form" id="checkout-form" novalidate>
        <p class="eyebrow">Checkout simulado</p>
        <h1>Entrega e pagamento</h1>
        <fieldset>
          <legend>Contato</legend>
          <label>Nome completo <input name="name" autocomplete="name" required /></label>
          <label>E-mail <input name="email" type="email" autocomplete="email" required /></label>
          <label>Telefone <input name="phone" placeholder="(11) 99999-9999" required /></label>
          <label>CPF <input name="cpf" placeholder="000.000.000-00" required /></label>
        </fieldset>
        <fieldset>
          <legend>Endereco</legend>
          <div class="form-grid">
            <label>CEP <input name="cep" placeholder="00000-000" required /></label>
            <label>Estado
              <select name="state" required>
                <option value="">UF</option>
                ${["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => `<option>${uf}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>Rua <input name="street" required /></label>
          <div class="form-grid">
            <label>Numero <input name="number" required /></label>
            <label>Complemento <input name="complement" /></label>
          </div>
          <div class="form-grid">
            <label>Bairro <input name="district" required /></label>
            <label>Cidade <input name="city" required /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Entrega</legend>
          <label class="radio-card">
            <input type="radio" name="shipping" value="padrao" checked />
            <span><strong>Entrega padrao</strong><small>4 a 7 dias uteis / ${money(shippingCost("padrao"))}</small></span>
          </label>
          <label class="radio-card">
            <input type="radio" name="shipping" value="expressa" />
            <span><strong>Entrega expressa</strong><small>2 a 3 dias uteis / ${money(shippingCost("expressa"))}</small></span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Pagamento</legend>
          <label class="radio-card">
            <input type="radio" name="payment" value="pix" checked />
            <span><strong>Pix</strong><small>Confirmacao simulada imediata</small></span>
          </label>
          <label class="radio-card">
            <input type="radio" name="payment" value="credito" />
            <span><strong>Cartao de credito</strong><small>Ate 6x sem juros no prototipo</small></span>
          </label>
          <label class="radio-card">
            <input type="radio" name="payment" value="parcelado" />
            <span><strong>Parcelamento</strong><small>Simulacao de parcelas para validacao de UX</small></span>
          </label>
        </fieldset>
        <div class="form-error" id="form-error" role="alert"></div>
        <button class="button primary wide" type="submit">Finalizar pedido simulado</button>
      </form>
      <aside class="summary-panel">
        ${summaryBlock("padrao")}
      </aside>
    </section>
  `);
}

function confirmationPage() {
  const order = state.checkout;
  return pageShell(`
    <section class="confirmation">
      <p class="eyebrow">Pedido simulado</p>
      <h1>Compra confirmada para validacao do prototipo.</h1>
      <p>
        ${order?.name ? `${escapeHtml(order.name)}, ` : ""}este fluxo nao gera cobranca real.
        Use esta tela para revisar a experiencia de pos-compra.
      </p>
      <div class="confirmation-card">
        <span>Numero do pedido</span>
        <strong>BV-${Math.floor(100000 + Math.random() * 900000)}</strong>
        <small>Pagamento: ${paymentLabel(order?.payment || "pix")} / Entrega: ${shippingLabel(order?.shipping || "padrao")}</small>
      </div>
      <a class="button primary" href="#/">Voltar ao inicio</a>
    </section>
  `);
}

function productCard(product) {
  return `
    <article class="product-card">
      <a href="#/produto/${product.id}" class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      </a>
      <div class="product-card-body">
        <span>${product.brand}</span>
        <a href="#/produto/${product.id}"><h3>${product.name}</h3></a>
        <p>${product.subcategory}</p>
        <div class="product-card-bottom">
          <strong>${money(product.priceBRL)}</strong>
          <button data-add="${product.id}" aria-label="Adicionar ${product.name}">Adicionar</button>
        </div>
      </div>
    </article>
  `;
}

function cartRow(item) {
  return `
    <article class="cart-row">
      <img src="${item.product.image}" alt="${item.product.name}" />
      <div>
        <span>${item.product.brand}</span>
        <strong>${item.product.name}</strong>
        <small>${money(item.product.priceBRL)}</small>
      </div>
      <div class="qty-control">
        <button data-qty="${item.id}" data-delta="-1" aria-label="Diminuir quantidade">-</button>
        <span>${item.qty}</span>
        <button data-qty="${item.id}" data-delta="1" aria-label="Aumentar quantidade">+</button>
      </div>
      <button class="remove-button" data-remove="${item.id}">Remover</button>
    </article>
  `;
}

function summaryBlock(method = "padrao") {
  return `
    <div class="summary-block">
      <h2>Resumo</h2>
      <div><span>Subtotal</span><strong>${money(subtotal())}</strong></div>
      <div><span>Desconto curadoria</span><strong>-${money(discount())}</strong></div>
      <div><span>Frete</span><strong>${shippingCost(method) === 0 ? "Gratis" : money(shippingCost(method))}</strong></div>
      <div class="summary-total"><span>Total</span><strong>${money(total(method))}</strong></div>
      <p>Frete gratis acima de R$ 299,00. Desconto automatico de 10% acima de R$ 250,00.</p>
    </div>
  `;
}

function emptyState(title, message) {
  return `
    <div class="empty-state">
      <strong>${title}</strong>
      <p>${message}</p>
      <a class="button secondary" href="#/categoria/all">Explorar catalogo</a>
    </div>
  `;
}

function filteredProducts() {
  let list = [...products];
  const { category, brand, query, sort } = state.filters;
  if (category !== "all") list = list.filter((product) => product.category === category);
  if (brand !== "all") list = list.filter((product) => product.brand === brand);
  if (query.trim()) {
    const term = query.trim().toLowerCase();
    list = list.filter((product) =>
      [product.name, product.brand, product.subcategory, product.descriptionPt].join(" ").toLowerCase().includes(term)
    );
  }
  if (sort === "price-asc") list.sort((a, b) => a.priceBRL - b.priceBRL);
  if (sort === "price-desc") list.sort((a, b) => b.priceBRL - a.priceBRL);
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  return list;
}

function addToCart(id) {
  const existing = state.cart.find((item) => item.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1 });
  saveCart();
  render();
}

function changeQty(id, delta) {
  const item = state.cart.find((entry) => entry.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
  saveCart();
  render();
}

function removeItem(id) {
  state.cart = state.cart.filter((entry) => entry.id !== id);
  saveCart();
  render();
}

function validateCheckout(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const required = ["name", "email", "phone", "cpf", "cep", "state", "street", "number", "district", "city"];
  const missing = required.filter((key) => !String(data[key] || "").trim());
  if (missing.length) return { ok: false, message: "Preencha todos os campos obrigatorios." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: false, message: "Informe um e-mail valido." };
  if (digits(data.cpf).length !== 11) return { ok: false, message: "CPF deve ter 11 digitos." };
  if (digits(data.cep).length !== 8) return { ok: false, message: "CEP deve ter 8 digitos." };
  if (digits(data.phone).length < 10) return { ok: false, message: "Telefone deve ter DDD e numero." };
  return { ok: true, data };
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function paymentLabel(value) {
  return { pix: "Pix", credito: "Cartao de credito", parcelado: "Parcelamento" }[value] || "Pix";
}

function shippingLabel(value) {
  return value === "expressa" ? "Expressa" : "Padrao";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  state.route = parseRoute();
  if (state.route.name === "home") app.innerHTML = homePage();
  if (state.route.name === "catalog") app.innerHTML = catalogPage(state.route.category);
  if (state.route.name === "product") app.innerHTML = productPage(state.route.id);
  if (state.route.name === "carrinho") app.innerHTML = cartPage();
  if (state.route.name === "checkout") app.innerHTML = checkoutPage();
  if (state.route.name === "confirmacao") app.innerHTML = confirmationPage();
  window.scrollTo({ top: 0, behavior: "instant" });
}

window.addEventListener("hashchange", render);

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const qtyButton = event.target.closest("[data-qty]");
  const removeButton = event.target.closest("[data-remove]");
  const categoryButton = event.target.closest("[data-category]");
  const brandButton = event.target.closest("[data-brand]");

  if (addButton) {
    addToCart(addButton.dataset.add);
  }
  if (qtyButton) {
    changeQty(qtyButton.dataset.qty, Number(qtyButton.dataset.delta));
  }
  if (removeButton) {
    removeItem(removeButton.dataset.remove);
  }
  if (categoryButton) {
    state.filters.category = categoryButton.dataset.category;
    window.location.hash = `#/categoria/${state.filters.category}`;
  }
  if (brandButton) {
    state.filters.brand = brandButton.dataset.brand;
    window.location.hash = "#/categoria/all";
  }
});

document.addEventListener("input", (event) => {
  const filter = event.target.closest("[data-filter]");
  if (!filter) return;
  state.filters[filter.dataset.filter] = filter.value;
  if (filter.dataset.filter === "category") window.location.hash = `#/categoria/${filter.value}`;
  else render();
});

document.addEventListener("change", (event) => {
  if (event.target.name === "shipping" && state.route.name === "checkout") {
    const summary = document.querySelector(".summary-panel");
    if (summary) summary.innerHTML = summaryBlock(event.target.value);
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "checkout-form") return;
  event.preventDefault();
  const result = validateCheckout(event.target);
  const error = document.querySelector("#form-error");
  if (!result.ok) {
    error.textContent = result.message;
    return;
  }
  state.checkout = result.data;
  state.cart = [];
  saveCart();
  window.location.hash = "#/confirmacao";
});

render();
