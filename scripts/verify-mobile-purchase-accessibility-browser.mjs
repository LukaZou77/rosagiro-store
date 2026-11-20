import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

// Run from the project root. All browser requests are intercepted.
const origin = "http://127.0.0.1:9243";
const artifacts = process.env.RG_MOBILE_A11Y_ARTIFACTS;
if (artifacts) await mkdir(artifacts, { recursive: true });

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const mocks = {
  "next/navigation": `
    export function usePathname() { return location.pathname; }
    export function useRouter() { return { push(path) { globalThis.checkoutNavigationTarget = path; } }; }
  `,
  "next/link": `export default function Link({ children, ...props }) { return <a {...props}>{children}</a>; }`,
  "next/image": `export default function Image({ fill, priority, ...props }) { return <img {...props} />; }`
};

const bundle = await build({
  stdin: {
    contents: `
      import { createRoot } from 'react-dom/client';
      import { CheckoutClient } from './components/CheckoutClient';
      import { CartClient } from './components/CartClient';
      import { CustomerSessionProvider, CustomerCheckoutButton } from './components/CustomerSession';
      import { QuickPurchaseDrawer } from './components/QuickPurchaseDrawer';
      createRoot(document.getElementById('root')).render(<CustomerSessionProvider>
        <main id="conteudo-principal" tabIndex={-1}>
          {location.pathname === '/checkout' ? <CheckoutClient trustSignals={[]} testPayments={false} /> :
            location.pathname === '/carrinho' ? <CartClient trustSignals={[]} /> : <>
              <CustomerCheckoutButton className="button primary">Entrar para continuar</CustomerCheckoutButton>
              <a href="/contato">Contato da loja</a>
            </>}
        </main>
        <QuickPurchaseDrawer />
      </CustomerSessionProvider>);
    `,
    loader: "tsx",
    resolveDir: process.cwd()
  },
  bundle: true, format: "iife", platform: "browser", jsx: "automatic", write: false,
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [{
    name: "browser-mocks",
    setup(build) {
      build.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (args) => ({ path: args.path, namespace: "stub" }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: mocks[args.path], loader: "tsx", resolveDir: process.cwd() }));
    }
  }]
});

const cart = [{ slug: "produto-teste", quantity: 12 }];
const customer = { id: "customer-test", name: "Pessoa Teste", whatsapp: "+55 11 99999-9999", whatsappDigits: "5511999999999" };
const summary = {
  lines: [{
    slug: "produto-teste", name: "Produto Teste", brandName: "Marca Teste", image: "", active: true, available: true,
    requestedQuantity: 12, quantity: 12, stockQuantity: 36, packagePieces: 6, packagePriceCents: 30_001,
    packageValid: true, packageCount: 2, priceCents: 5_000, lineTotalCents: 60_002, warning: ""
  }],
  subtotalCents: 60_002, discountCents: 0, totalCents: 60_002, minimumOrderCents: 50_000,
  remainingToMinimumCents: 0, minimumReached: true, packageReady: true,
  recommendations: [{
    slug: "outro-teste", name: "Sugestão de teste", brandName: "Marca Teste", image: "", reason: "Combina com sua lista",
    priceCents: 1_500, packagePriceCents: 9_000, stockQuantity: 24, packagePieces: 6
  }]
};

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function visit(path, viewport, options = {}) {
  const page = await browser.newPage({ viewport, locale: "pt-BR", reducedMotion: "reduce" });
  page.setDefaultTimeout(5_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ cart, customer, checkout, ignoreLoginAbort }) => {
    localStorage.setItem("bela-viva-cart", JSON.stringify(cart));
    if (checkout) localStorage.setItem("bela-viva-customer-session", JSON.stringify({ customer }));
    if (!ignoreLoginAbort) return;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (path, options) => {
      if (path !== "/api/customers/session") return originalFetch(path, options);

      // Emulate a late response even after an abort was requested.
      options.signal.addEventListener("abort", () => { globalThis.loginAbortObserved = true; });
      const response = await originalFetch(path, { ...options, signal: undefined });
      const json = await response.json();
      globalThis.loginResponseObserved = true;
      return Response.json(json, { status: response.status });
    };
  }, { cart, customer, checkout: path === "/checkout", ignoreLoginAbort: Boolean(options.session) });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === path) return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/fixture.js"></script></html>` });
    if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    if (url.pathname === "/app.css") return route.fulfill({ contentType: "text/css", body: css });
    if (url.pathname === "/api/cart/summary") return route.fulfill({ json: summary });
    if (url.pathname === "/api/customers/session" && options.session) return options.session(route);
    return route.abort();
  });
  await page.goto(`${origin}${path}`);
  return { page, errors };
}

async function expectFocused(locator) {
  await locator.and(locator.page().locator(":focus")).waitFor();
}

async function assertTouchTargets(page, container, type) {
  const targets = container.locator(".qty-control button, .remove-button, .completion-item > button");
  await targets.last().waitFor();
  const sizes = await targets.evaluateAll((nodes) => nodes.map((node) => {
    const { x, width, height } = node.getBoundingClientRect();
    return { x, width, height };
  }));
  assert.equal(sizes.length, 4);
  for (const { width, height, x } of sizes) {
    assert.ok(width >= 44 && height >= 44, `${type}: target ${width}×${height}`);
    assert.ok(x >= 0 && x + width <= page.viewportSize().width, `${type}: target exceeds viewport`);
  }
  assert.ok(sizes[1].x - sizes[0].x - sizes[0].width >= 8, `${type}: quantity buttons are too close`);
  console.log(`${page.viewportSize().width}px ${type} touch targets: ${sizes.map(({ width, height }) => `${Math.round(width)}×${Math.round(height)}`).join(", ")}`);
}

try {
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const { page, errors } = await visit("/checkout", viewport);
    const steps = page.locator(".checkout-stepper button");
    await steps.first().waitFor();
    const layout = await steps.evaluateAll((buttons) => buttons.map((button) => {
      const title = button.querySelector("strong");
      const range = document.createRange();
      range.selectNodeContents(title);
      const bounds = button.getBoundingClientRect();
      return {
        title: title.textContent,
        button: bounds.toJSON(),
        titleLines: Array.from(range.getClientRects(), (line) => line.toJSON())
      };
    }));
    assert.deepEqual(layout.map((step) => step.title), ["Contato", "Endereço de entrega", "Pagamento"]);
    for (const { title, button, titleLines } of layout) {
      assert.ok(button.height >= 44);
      assert.ok(titleLines.every((line) => line.left >= button.left && line.right <= button.right && line.bottom <= button.bottom), `${viewport.width}px: ${title} exceeds its card`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}px checkout title lines: ${layout.map(({ titleLines }) => titleLines.length).join(", ")}`);
    if (artifacts) await page.screenshot({ path: join(artifacts, `checkout-${viewport.width}.png`) });
    await page.close();

    const cartPage = await visit("/carrinho", viewport);
    await assertTouchTargets(cartPage.page, cartPage.page.locator("main"), "cart");
    assert.deepEqual(cartPage.errors, []);
    await cartPage.page.close();

    let sendResponse;
    const heldResponse = new Promise((resolve) => { sendResponse = resolve; });
    const overlayPage = await visit("/acessibilidade", viewport, {
      async session(route) {
        await heldResponse;
        return route.fulfill({ json: { customer } });
      }
    });
    const { page: overlay } = overlayPage;
    const entry = overlay.getByRole("button", { name: "Abrir pedido rápido" });
    const directEntry = overlay.getByRole("button", { name: "Entrar para continuar" });
    const drawer = overlay.locator(".quick-drawer-shell");
    const login = overlay.getByRole("dialog", { name: "Entrar via WhatsApp" });
    const closeDrawer = drawer.getByRole("button", { name: "Fechar pedido rápido" });
    const closeLogin = login.getByRole("button", { name: "Fechar login" });
    const checkoutEntry = drawer.getByRole("button", { name: "Continuar pedido" });
    const name = login.getByRole("textbox", { name: "Seu nome" });
    const whatsapp = login.getByRole("textbox", { name: "Seu WhatsApp" });
    const continueLogin = login.getByRole("button", { name: "Continuar" });

    await directEntry.focus();
    await overlay.keyboard.press("Enter");
    await expectFocused(name);
    await overlay.keyboard.press("Escape");
    await expectFocused(directEntry);
    await directEntry.click();
    await expectFocused(name);
    await overlay.mouse.click(2, 2);
    await expectFocused(directEntry);

    await entry.focus();
    await overlay.keyboard.press("Enter");
    await expectFocused(closeDrawer);
    await assertTouchTargets(overlay, drawer, "drawer");
    if (artifacts && viewport.width === 390) await overlay.screenshot({ path: join(artifacts, "quick-purchase-390.png") });
    await overlay.keyboard.press("Shift+Tab");
    await expectFocused(drawer.getByRole("link", { name: "Ver pedido completo" }));
    await overlay.keyboard.press("Tab");
    await expectFocused(closeDrawer);
    await checkoutEntry.focus();
    await overlay.keyboard.press("Enter");
    await expectFocused(name);
    assert.equal(await overlay.locator("dialog:modal").count(), 2);
    await overlay.locator('a[href="/contato"]').evaluate((background) => background.focus());
    await expectFocused(name);
    await overlay.keyboard.press("Shift+Tab");
    await expectFocused(closeLogin);
    await overlay.keyboard.press("Shift+Tab");
    await expectFocused(continueLogin);
    await overlay.keyboard.press("Tab");
    await expectFocused(closeLogin);
    await overlay.keyboard.press("Tab");
    await expectFocused(name);
    await overlay.keyboard.press("Tab");
    await expectFocused(whatsapp);
    await overlay.keyboard.press("Tab");
    await expectFocused(login.getByRole("link", { name: "Privacidade" }));
    await overlay.keyboard.press("Tab");
    await expectFocused(login.getByRole("button", { name: "Cancelar" }));
    await name.fill(customer.name);
    await whatsapp.fill("11 99999-9999");
    if (artifacts && viewport.width === 320) await overlay.screenshot({ path: join(artifacts, "nested-login-320.png") });

    const sessionRequest = overlay.waitForRequest((request) => request.url().endsWith("/api/customers/session"));
    await continueLogin.click();
    await sessionRequest;
    await overlay.keyboard.press("Escape");
    await expectFocused(checkoutEntry);
    await overlay.waitForFunction(() => globalThis.loginAbortObserved);
    assert.equal(await drawer.evaluate((element) => element.open), true);
    await overlay.keyboard.press("Enter");
    await expectFocused(name);
    assert.equal(await name.inputValue(), customer.name);
    assert.equal(await whatsapp.inputValue(), "11 99999-9999");
    sendResponse();
    await overlay.waitForFunction(() => globalThis.loginResponseObserved);
    assert.equal(await overlay.evaluate(() => localStorage.getItem("bela-viva-customer-session")), null);
    assert.equal(await overlay.evaluate(() => globalThis.checkoutNavigationTarget), undefined);
    await overlay.keyboard.press("Escape");
    await expectFocused(checkoutEntry);
    await overlay.keyboard.press("Escape");
    await expectFocused(entry);
    assert.equal(await overlay.locator("dialog:modal").count(), 0);

    await overlay.keyboard.press("Enter");
    await checkoutEntry.focus();
    await overlay.keyboard.press("Enter");
    await expectFocused(name);
    await continueLogin.click();
    await overlay.waitForFunction(() => globalThis.checkoutNavigationTarget === "/checkout");
    await drawer.waitFor({ state: "hidden" });
    assert.deepEqual(await overlay.evaluate(() => JSON.parse(localStorage.getItem("bela-viva-customer-session")).customer), customer);
    assert.deepEqual(overlayPage.errors, []);
    console.log(`${viewport.width}px native dialogs: keyboard wrap, background inert, backdrop and Escape restore focus, retained inputs, canceled and successful login`);
    await overlay.close();
  }
} finally {
  await browser.close();
}
