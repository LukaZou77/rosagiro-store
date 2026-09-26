import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const cssModuleMock = {
  actions: "actions",
  banner: "banner",
  button: "button",
  copy: "copy",
  settingsPanel: "settingsPanel"
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/components/AnalyticsConsent.module.css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: `export default ${JSON.stringify(cssModuleMock)};`
      };
    }
    return nextLoad(url, context);
  }
});

const { AnalyticsConsentSettingsButton, isAnalyticsConsentPublicPath } = await import("@/components/AnalyticsConsent");

test("shows consent UI only on visitor-facing public routes", () => {
  for (const path of ["/", "/categoria/rosto", "/carrinho", "/checkout", "/politica-de-privacidade"]) {
    assert.equal(isAnalyticsConsentPublicPath(path), true, path);
  }
  for (const path of ["/admin", "/admin/produtos", "/api/orders", "/pedido/RG-1", "/pagamento-simulado/RG-1"]) {
    assert.equal(isAnalyticsConsentPublicPath(path), false, path);
  }
});

test("renders a reusable privacy settings control", () => {
  const html = renderToStaticMarkup(<AnalyticsConsentSettingsButton />);
  assert.match(html, /Configurar medição/);
  assert.match(html, /type="button"/);
});

test("privacy page keeps a permanent consent entry point and factual Google disclosure", () => {
  const source = readFileSync(new URL("../app/politica-de-privacidade/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<AnalyticsConsentSettingsButton \/>/);
  assert.match(source, /Google Analytics e Google Ads/);
  assert.match(source, /CPF, e-mail, telefone, conteúdo de mensagens ou conversas no WhatsApp/);
  assert.match(source, /https:\/\/policies\.google\.com\/privacy/);
});

test("mobile consent layout clears fixed navigation and remains scrollable on short screens", () => {
  const component = readFileSync(new URL("./AnalyticsConsent.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./AnalyticsConsent.module.css", import.meta.url), "utf8");

  assert.match(component, /className=\{styles\.banner\}/);
  assert.match(css, /z-index:\s*85/);
  assert.match(css, /@media \(max-width: 959px\)/);
  assert.match(css, /bottom:\s*calc\(140px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 164px - env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /overscroll-behavior:\s*contain/);
});
