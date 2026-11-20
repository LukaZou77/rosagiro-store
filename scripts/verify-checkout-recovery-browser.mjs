import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Run from the project root with `node scripts/verify-checkout-recovery-browser.mjs`.
// The browser uses the production CheckoutClient source with all requests intercepted.
const mocks = {
  "next/navigation": `export function useRouter() { return { push(path) { globalThis.checkoutNavigationTarget = path; throw Error('simulated navigation failure'); } }; }`,
  "next/link": `export default function Link({children, ...props}) { return <a {...props}>{children}</a> }`,
  "next/image": `export default function Image(props) { return <img {...props} /> }`,
  "@/components/CustomerSession": `const customer = { name: 'Pessoa Teste', whatsapp: '11999999999' }; const requireCustomerSession = () => true; export function useCustomerSession() { return { customer, requireCustomerSession }; }`
};
const bundle = await build({
  stdin: {
    contents: `import { createRoot } from 'react-dom/client'; import { CheckoutClient } from './components/CheckoutClient'; createRoot(document.getElementById('root')).render(<CheckoutClient trustSignals={[]} testPayments={false} />);`,
    loader: "tsx",
    resolveDir: process.cwd()
  },
  bundle: true, format: "iife", platform: "browser", jsx: "automatic", write: false,
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [{
    name: "browser-mocks",
    setup(build) {
      build.onResolve({ filter: /^(next\/(navigation|link|image)|@\/components\/CustomerSession)$/ }, (args) => ({ path: args.path, namespace: "stub" }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: mocks[args.path], loader: "tsx", resolveDir: process.cwd() }));
    }
  }]
});
const browser = await chromium.launch({ channel: "chrome", headless: true });

const number = "RG-TESTE-1001";
const cart = [{ slug: "produto-teste", quantity: 12 }];

async function fillCheckout(form) {
  await form.locator('[name="email"]').fill("teste@example.test");
  await form.locator('[name="cpf"]').fill("12345678909");
  await form.locator('[name="cep"]').fill("01001-000");
  await form.locator('[name="state"]').selectOption("SP");
  await form.locator('[name="city"]').fill("São Paulo");
  await form.locator('[name="street"]').fill("Praça da Sé");
  await form.locator('[name="number"]').fill("1");
  await form.locator('[name="district"]').fill("Sé");
  await form.locator('[name="freightSeparateAccepted"]').check();
}

try {
  const page = await browser.newPage();
  const requests = [];
  const pageErrors = [];
  let mockResponse = "non-json";
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const { origin, pathname: path } = new URL(route.request().url());
    if (origin !== "http://127.0.0.1:9242") return route.abort();
    if (path === "/") return route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script src="/checkout-bundle.js"></script>` });
    if (path === "/checkout-bundle.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    if (path === "/api/cart/summary") return route.fulfill({ json: {
      lines: [{ ...cart[0], name: "Produto Teste", brandName: "Marca", available: true, packageValid: true, packagePieces: 12, packageCount: 1, lineTotalCents: 60_000 }],
      subtotalCents: 60_000, totalCents: 60_000, minimumReached: true, packageReady: true, recommendations: []
    } });
    if (path === "/api/cep/01001000") return route.fulfill({ status: 404, json: {} });
    if (path === "/api/orders") {
      requests.push(route.request().postDataJSON());
      if (mockResponse === "non-json") return route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Erro</h1>" });
      if (mockResponse === "rejected") return route.fulfill({ status: 400, json: { error: "Confira o endereço.", orderCreated: false } });
      const order = { orderNumber: number, orderCreated: true, redirectTo: `/pedido/${number}`, externalRedirect: false };
      if (mockResponse === "pending") {
        return route.fulfill({ status: 202, json: { ...order, paymentPending: true, error: "Seu pedido foi salvo." } });
      }
      return route.fulfill({ json: order });
    }
    return route.abort();
  });
  await page.addInitScript((initialCart) => {
    if (localStorage.getItem("bela-viva-cart") === null) localStorage.setItem("bela-viva-cart", JSON.stringify(initialCart));
  }, cart);

  await page.goto("http://127.0.0.1:9242/");
  const form = page.locator("#checkout-form");
  await fillCheckout(form);
  await form.evaluate((node) => { node.requestSubmit(); node.requestSubmit(); });

  const verify = page.getByRole("button", { name: "Verificar pedido", exact: true });
  await verify.waitFor();
  assert.equal(await verify.isEnabled(), true);
  assert.equal(requests.length, 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bela-viva-cart"))[0].quantity), 12);
  assert.match(requests[0].checkoutAttemptId, /^[0-9a-f-]{36}$/);
  await page.reload();
  await verify.waitFor();
  assert.equal(requests.length, 1);

  mockResponse = "rejected";
  await verify.click();
  await page.getByRole("alert").filter({ hasText: "Confira o endereço." }).waitFor();
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(await form.locator('[name="email"]').inputValue(), "teste@example.test");
  assert.equal(await form.locator('[name="street"]').inputValue(), "Praça da Sé");
  assert.equal(await form.locator('[name="freightSeparateAccepted"]').isChecked(), true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("rosagiro:checkout-recovery:v1")), null);

  mockResponse = "pending";
  await form.evaluate((node) => node.requestSubmit());
  await page.getByRole("heading", { name: `Pedido ${number} criado.` }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Acompanhar pedido" }).getAttribute("href"), `/pedido/${number}`);
  assert.notEqual(requests[2].checkoutAttemptId, requests[0].checkoutAttemptId);
  assert.equal(await page.evaluate(() => localStorage.getItem("bela-viva-cart")), "[]");
  const confirmedRecord = await page.evaluate(() => sessionStorage.getItem("rosagiro:checkout-recovery:v1"));
  assert.doesNotMatch(confirmedRecord, /teste@example.test|12345678909|Praça da Sé/);
  await page.reload();
  await page.getByRole("link", { name: "Acompanhar pedido" }).waitFor();

  await page.evaluate((initialCart) => {
    localStorage.setItem("bela-viva-cart", JSON.stringify(initialCart));
    sessionStorage.removeItem("rosagiro:checkout-recovery:v1");
  }, cart);
  await page.reload();
  await page.evaluate(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.sessionStorage && key === "rosagiro:checkout-recovery:v1") throw Error("Storage blocked");
      return save.call(this, key, value);
    };
  });
  mockResponse = "non-json";
  await fillCheckout(form);
  await form.evaluate((node) => node.requestSubmit());
  await page.getByRole("alert").filter({ hasText: "não conseguiu guardar os dados de recuperação" }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("rosagiro:checkout-recovery:v1")), null);

  mockResponse = "success";
  await verify.click();
  await page.getByRole("heading", { name: `Pedido ${number} criado.` }).waitFor();
  await page.waitForFunction((path) => globalThis.checkoutNavigationTarget === path, `/pedido/${number}`);
  assert.deepEqual(requests[4], requests[3]);
  assert.equal(await page.getByRole("link", { name: "Acompanhar pedido" }).getAttribute("href"), `/pedido/${number}`);
  assert.equal(await page.evaluate(() => localStorage.getItem("bela-viva-cart")), "[]");
  assert.deepEqual(pageErrors, []);
  console.log("Browser verification passed for same-tick duplicate submission, exact retry after reload, editable validation error, 202 confirmation, storage denial, cart retention and cleanup, private snapshot cleanup, and navigation failure recovery.");
} finally {
  await browser.close();
}
