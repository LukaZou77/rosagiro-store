import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Actual components, isolated browser, intercepted network: no live admin writes.
const origin = "http://127.0.0.1:9244";
const mocks = {
  "next/navigation": `export function usePathname() { return '/admin'; } export function unstable_rethrow(error) { if (error.name === 'NEXT_REDIRECT') throw error; }`,
  "next/link": `export default function Link({children, prefetch, ...props}) { return <a {...props}>{children}</a>; }`,
  "@/app/admin/actions": `export async function logoutAction() {}`,
  "@/components/AdminLanguageProvider": `const t = (pt) => pt; export function useAdminLanguage() { return {locale:'pt-BR',t}; } export function AdminLanguageSwitch() { return null; }`,
  "@/components/AdminSectionNav": `export function AdminSectionNav() { return null; } export function getAdminPageLabel() { return null; }`
};
const bundle = await build({
  stdin: {
    contents: `import {createRoot} from 'react-dom/client'; import {Component,useState} from 'react';
      import {AdminShellClient} from './components/AdminShellClient';
      import {AdminProductBulkList} from './components/AdminProductBulkList';
      import {AdminProductForm} from './components/AdminProductForm';
      import {AdminProductSubmitButton} from './components/AdminProductSubmitButton';
      import {productEditorPath} from './lib/admin-product-navigation';
      const returnTo = '/admin/produtos?q=R%C3%B3sea&stock=in&page=2';
      let productSubmissionCount = 0;
      async function saveProduct(form) {
        const files = await Promise.all(form.getAll('galleryFiles').map(async file => [file.name, Array.from(new Uint8Array(await file.arrayBuffer()))]));
        await globalThis.recordProductSubmission({ name: form.get('name'), description: form.get('descriptionPt'), sku: form.get('skuCode:'+form.get('skuRowKey')), primary: form.get('primaryUploadIndex'), returnTo: form.get('returnTo'), files });
        productSubmissionCount++;
        if (productSubmissionCount === 1) {
          await new Promise(resolve => { globalThis.finishProductSave = resolve; });
          return { error: 'Este slug já existe.' };
        }
        if (productSubmissionCount === 2) return { error: 'A sessão expirou.', loginRequired: true };
        const redirect = new Error('Saved');
        redirect.name = 'NEXT_REDIRECT';
        redirect.href = productEditorPath('/admin/produtos/novo-teste', form.get('returnTo'), true);
        throw redirect;
      }
      class RedirectBoundary extends Component {
        state = { redirecting: false };
        static getDerivedStateFromError() { return { redirecting: true }; }
        componentDidCatch(error) {
          if (error.name !== 'NEXT_REDIRECT') throw error;
          location.assign(error.href);
        }
        render() { return this.state.redirecting ? null : this.props.children; }
      }
      const notice = {id:'n1',createdAt:'2026-11-20T12:00:00Z',readAt:null,title:'Pedido criado',message:'Teste',notificationType:'ORDER_CREATED',actionHref:'#order',payload:{}};
      const productRows = ids => ids.map(id=>({id,slug:id,name:id,image:'',brandName:'Marca',categoryLabel:'Categoria',subcategory:'',price:'R$ 1',active:true,inStock:true,featuredRank:0,weightGrams:1,qualityStatusLabel:null,qualityStatusClass:null}));
      function Fixture() {
        const [products, setProducts] = useState(() => productRows(['a','b']));
        globalThis.replaceProducts = ids => setProducts(productRows(ids));
        return <AdminShellClient adminName="Teste" outOfStockCount={0} initialUnreadNotificationCount={120} initialNotifications={[notice]}>
          <AdminProductBulkList products={products} action={async()=>{}} returnTo={returnTo} />
          <form action={async()=>{await new Promise(r=>{globalThis.finishSave=r;});}}><AdminProductSubmitButton className="" label="Salvar status" /></form>
          <RedirectBoundary><AdminProductForm action={saveProduct} brands={[{id:'marca',name:'Marca'}]} categories={[{id:'cat',label:'Categoria',subcategories:[{id:'sub',label:'Subcategoria'}]}]} mode="create" locale="pt-BR" returnTo={returnTo} /></RedirectBoundary>
        </AdminShellClient>;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);`, loader: "tsx", resolveDir: process.cwd()
  }, bundle: true, format: "iife", platform: "browser", jsx: "automatic", write: false,
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [{name:"stubs",setup(build) {
    build.onResolve({filter:/^(next\/(navigation|link)|@\/app\/admin\/actions|@\/components\/(AdminLanguageProvider|AdminSectionNav))$/}, a=>({path:a.path,namespace:"stub"}));
    build.onLoad({filter:/.*/,namespace:"stub"}, a=>({contents:mocks[a.path],loader:"tsx",resolveDir:process.cwd()}));
  }}]
});
const browser = await chromium.launch({channel:"chrome",headless:true});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(5_000);
  let fail = true;
  let failRefresh = true;
  let unread = 120;
  let writes = 0;
  let delayedReads = 0;
  let releaseStale;
  const holdStale = new Promise((resolve) => { releaseStale = resolve; });
  const errors = [];
  const submissions = [];
  await page.exposeBinding("recordProductSubmission", (_, submission) => { submissions.push(submission); });
  page.on("pageerror", error=>errors.push(error.message));
  await page.route("**/*", async route=>{
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/") return route.fulfill({contentType:"text/html",body:'<div id="root"></div><script src="/bundle.js"></script>'});
    if (url.pathname === "/bundle.js") return route.fulfill({contentType:"text/javascript",body:bundle.outputFiles[0].text});
    if (url.pathname === "/admin/produtos/novo-teste") return route.fulfill({ contentType: "text/html", body: "<p role='status'>Produto salvo com sucesso.</p>" });
    if (url.pathname === "/api/admin/notifications/read") {
      writes++;
      if (fail) return route.fulfill({status:500,json:{error:"test failure"}});
      unread = 0;
      return route.fulfill({json:{ok:true,updated:120}});
    }
    if (url.pathname === "/api/admin/notifications") {
      if (!unread && failRefresh) return route.fulfill({status:502,json:{error:"test failure after write"}});
      const unreadCount = unread;
      if (delayedReads < 2) {
        delayedReads++;
        await holdStale;
      }
      const notifications = [{id:"n1",createdAt:"2026-11-20T12:00:00Z",readAt:unreadCount?null:"2026-11-20T12:01:00Z",title:"Pedido criado",message:"Teste",notificationType:"ORDER_CREATED",actionHref:"#order",payload:{}}];
      return route.fulfill({json:url.searchParams.has("summary") ? {unreadCount} : {unreadCount, notifications}});
    }
    return route.abort();
  });
  await page.goto(origin);
  const all = page.getByRole("checkbox",{name:"Selecionar todos"});
  await page.getByRole("checkbox",{name:"Selecionar a",exact:true}).check();
  assert.equal(await all.evaluate(el=>el.indeterminate),true);
  await all.check();
  assert.equal(await all.evaluate(el=>el.indeterminate),false);
  const edit = page.getByRole("link", { name: "Editar ficha", exact: true }).first();
  assert.equal(new URL(await edit.getAttribute("href"), origin).searchParams.get("returnTo"), "/admin/produtos?q=R%C3%B3sea&stock=in&page=2");
  await page.evaluate(() => globalThis.replaceProducts(["b", "c"]));
  await page.getByRole("checkbox", { name: "Selecionar c", exact: true }).waitFor();
  assert.equal(await all.isChecked(), false);
  assert.equal(await all.evaluate(el => el.indeterminate), true);
  assert.deepEqual(await page.locator('input[name="productIds"]').evaluateAll(inputs => inputs.map(input => input.value)), ["b"]);
  await page.evaluate(() => globalThis.replaceProducts(["a", "c"]));
  await page.getByRole("checkbox", { name: "Selecionar a", exact: true }).waitFor();
  assert.equal(await all.evaluate(el => el.indeterminate), false);
  assert.equal(await page.locator('input[name="productIds"]').count(), 0);
  const save = page.getByRole("button",{name:"Salvar status",exact:true});
  await save.click();
  await page.getByRole("button",{name:"Salvando...",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Salvando...",exact:true}).isDisabled(),true);
  await page.evaluate(()=>globalThis.finishSave());
  await save.waitFor();
  const bell = page.getByRole("button",{name:"Notificações: 120 não lidas",exact:true});
  assert.equal(await bell.innerText(),"99+");
  const listRequest = page.waitForRequest(request => request.url() === `${origin}/api/admin/notifications`);
  await bell.click();
  await listRequest;
  const summaryRequest = page.waitForRequest(request => request.url() === `${origin}/api/admin/notifications?summary=1`);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await summaryRequest;
  await page.getByRole("button",{name:"Marcar todas como lidas",exact:true}).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await bell.innerText(),"99+");
  assert.equal(await page.locator('.admin-notification-list a.is-unread').count(),1);
  fail = false;
  await page.getByRole("button",{name:"Marcar todas como lidas",exact:true}).click();
  const allReadBell = page.getByRole("button",{name:"Notificações: 0 não lidas",exact:true});
  await allReadBell.waitFor();
  assert.equal(await page.locator('.admin-notification-list a.is-unread').count(),0);
  await page.getByRole("alert").filter({ hasText: "A leitura foi registrada" }).waitFor();
  const staleList = page.waitForResponse(response => response.url() === `${origin}/api/admin/notifications`);
  const staleSummary = page.waitForResponse(response => response.url() === `${origin}/api/admin/notifications?summary=1`);
  releaseStale();
  await Promise.all([staleList, staleSummary].map(async response => (await response).finished()));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await allReadBell.count(), 1);
  assert.equal(await page.locator('.admin-notification-list a.is-unread').count(), 0);
  failRefresh = false;
  await page.keyboard.press("Escape");
  await allReadBell.click();
  await page.getByRole("alert").waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  assert.equal(writes,2);

  const editor = page.locator(".product-editor");
  const create = editor.getByRole("button", { name: "Criar produto", exact: true });
  const name = editor.locator('[name="name"]');
  const description = editor.locator('[name="descriptionPt"]');
  const fileInput = editor.locator('[name="galleryFiles"]');
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ZkAAAAASUVORK5CYII=", "base64");
  await name.fill("Produto em edição");
  await description.fill("Descrição preservada após erro.");
  await editor.locator('[name="price"]').fill("12,34");
  await editor.getByRole("button", { name: "Adicionar SKU", exact: true }).click();
  await editor.getByRole("textbox", { name: "Nome da variação" }).fill("Cor nova");
  await editor.getByRole("textbox", { name: "Código SKU" }).fill("RG-TESTE-SKU");
  await fileInput.setInputFiles(["frente.png", "verso.png"].map(name => ({ name, mimeType: "image/png", buffer: image })));
  await editor.getByRole("radio", { name: "Principal", exact: true }).last().check();
  await editor.evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  const saving = editor.getByRole("button", { name: "Salvando...", exact: true });
  await saving.waitFor();
  assert.equal(await saving.isDisabled(), true);
  await page.waitForFunction(() => typeof globalThis.finishProductSave === "function");
  await page.evaluate(() => globalThis.finishProductSave());
  await editor.getByRole("alert").filter({ hasText: "Este slug já existe" }).waitFor();
  assert.equal(await name.inputValue(), "Produto em edição");
  assert.equal(await description.inputValue(), "Descrição preservada após erro.");
  assert.equal(await editor.getByRole("textbox", { name: "Código SKU" }).inputValue(), "RG-TESTE-SKU");
  assert.equal(await fileInput.evaluate(input => input.files.length), 2);
  assert.equal(await editor.getByRole("radio", { name: "Principal", exact: true }).last().isChecked(), true);
  assert.equal(submissions.length, 1);
  assert.deepEqual(submissions[0].files, ["frente.png", "verso.png"].map(name => [name, Array.from(image)]));
  assert.equal(submissions[0].primary, "1");
  await create.click();
  const login = editor.getByRole("link", { name: "Entrar em nova aba" });
  await login.waitFor();
  assert.equal(await login.getAttribute("href"), "/admin/login");
  assert.equal(await login.getAttribute("target"), "_blank");
  assert.equal(await name.inputValue(), "Produto em edição");
  assert.equal(await fileInput.evaluate(input => input.files.length), 2);
  await create.click();
  await page.getByRole("status").filter({ hasText: "Produto salvo com sucesso" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), "/admin/produtos?q=R%C3%B3sea&stock=in&page=2");
  assert.deepEqual(submissions, [submissions[0], submissions[0], submissions[0]]);
  assert.deepEqual(errors,[]);
  console.log("Admin feedback passed: stale selections and notification responses, pending save, and product draft/File/SKU retention through a failed save and successful retry with filters.");
} finally { await browser.close(); }
