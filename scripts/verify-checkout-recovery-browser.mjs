import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
const companyDocument = "12.abc.345/01de-35";
const emailAddress = "teste@example.test";
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function checkoutStep(form, name) {
  return form.locator(`[data-checkout-step="${name}"]`);
}

async function advanceToPayment(form) {
  await checkoutStep(form, "contact").getByRole("button", { name: "Continuar", exact: true }).click();
  const address = checkoutStep(form, "address");
  await address.locator('[name="cep"]').fill("01001-000");
  await address.locator('[name="state"]').selectOption("SP");
  await address.locator('[name="city"]').fill("São Paulo");
  await address.locator('[name="street"]').fill("Praça da Sé");
  await address.locator('[name="number"]').fill("1");
  await address.locator('[name="district"]').fill("Sé");
  await address.getByRole("button", { name: "Continuar", exact: true }).click();
  await checkoutStep(form, "payment").locator('[name="freightSeparateAccepted"]').check();
  assert.equal(await form.locator('[data-checkout-step="payment"].is-active').count(), 1);
}

try {
  const page = await browser.newPage();
  const requests = [];
  const pageErrors = [];
  let failNextSummary = false;
  let mockResponse = "non-json";
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const { origin, pathname: path } = new URL(route.request().url());
    if (origin !== "http://127.0.0.1:9242") return route.abort();
    if (path === "/") return route.fulfill({ contentType: "text/html", body: `<link rel="stylesheet" href="/checkout.css"><div id="root"></div><script src="/checkout-bundle.js"></script>` });
    if (path === "/checkout.css") return route.fulfill({ contentType: "text/css", body: css });
    if (path === "/checkout-bundle.js") return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    if (path === "/api/cart/summary") {
      if (failNextSummary) {
        failNextSummary = false;
        return route.fulfill({ status: 503, json: { error: "Resumo temporariamente indisponível." } });
      }
      const { items } = route.request().postDataJSON();
      const lines = items.map((item) => ({
        ...item,
        name: "Produto Teste", brandName: "Marca", available: true, packageValid: true,
        priceCents: 5_000, packagePriceCents: 60_000, packagePieces: 12, packageCount: item.quantity / 12,
        lineTotalCents: item.quantity * 5_000
      }));
      const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      return route.fulfill({ json: {
        lines, subtotalCents, totalCents: subtotalCents, minimumReached: true, packageReady: true, recommendations: []
      } });
    }
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
  const email = form.getByRole("textbox", { name: "E-mail", exact: true });
  const document = form.getByRole("textbox", { name: "CPF ou CNPJ", exact: true });
  const continueContact = checkoutStep(form, "contact").getByRole("button", { name: "Continuar", exact: true });

  await email.fill("teste");
  await continueContact.click();
  assert.equal(await email.getAttribute("aria-invalid"), "true");
  assert.equal(await email.getAttribute("aria-describedby"), "checkout-step-error");
  await email.fill(emailAddress);
  await document.fill("12.ABC.345/01DE-36");
  await continueContact.click();
  assert.equal(await document.getAttribute("aria-invalid"), "true");
  assert.equal(await document.getAttribute("aria-describedby"), "checkout-document-help checkout-step-error");
  await document.fill(companyDocument);
  await document.evaluate((input) => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    input.form.requestSubmit();
  });
  assert.equal(await form.locator('[data-checkout-step="contact"].is-active').count(), 1);

  failNextSummary = true;
  const changedCart = [{ ...cart[0], quantity: 24 }];
  await page.evaluate((items) => {
    localStorage.setItem("bela-viva-cart", JSON.stringify(items));
    window.dispatchEvent(new Event("bela-viva-cart-changed"));
  }, changedCart);
  await page.getByRole("heading", { name: "Resumo indisponível." }).waitFor();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await form.waitFor();
  assert.equal(page.url(), "http://127.0.0.1:9242/");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("bela-viva-cart"))), changedCart);
  assert.equal(await email.inputValue(), emailAddress);
  assert.equal(await document.inputValue(), companyDocument);
  assert.equal(requests.length, 0);
  await advanceToPayment(form);
  await form.evaluate((node) => { node.requestSubmit(); node.requestSubmit(); });

  const verify = page.getByRole("button", { name: "Verificar pedido", exact: true });
  await verify.waitFor();
  assert.equal(await verify.isEnabled(), true);
  assert.equal(requests.length, 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("bela-viva-cart"))[0].quantity), 24);
  assert.equal(requests[0].customer.cpf, companyDocument);
  assert.match(requests[0].checkoutAttemptId, /^[0-9a-f-]{36}$/);
  await page.reload();
  await verify.waitFor();
  assert.equal(requests.length, 1);

  mockResponse = "rejected";
  await verify.click();
  await page.getByRole("alert").filter({ hasText: "Confira o endereço." }).waitFor();
  assert.deepEqual(requests[1], requests[0]);
  assert.equal(await form.locator('[name="email"]').inputValue(), emailAddress);
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
  assert.doesNotMatch(confirmedRecord, /teste@example.test|12\.abc\.345\/01de-35|Praça da Sé/);
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
  await email.fill(emailAddress);
  await document.fill("280.012.389-38");
  await advanceToPayment(form);
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
  console.log("Browser verification passed for CPF and alphanumeric CNPJ, linked field errors, composition Enter, in-place summary retry with form retention, same-tick duplicate submission, exact retry after reload, editable validation error, 202 confirmation, storage denial, cart cleanup, private snapshot cleanup, and navigation failure recovery.");
} finally {
  await browser.close();
}
