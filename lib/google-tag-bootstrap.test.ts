import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { analyticsPageContext, googleTagBootstrap } from "./google-tag-bootstrap";

function bootstrapFixture(overrides: { dnt?: string; gpc?: boolean; pathname?: string; consent?: string; storageBlocked?: boolean } = {}) {
  const calls: unknown[][] = [];
  const scripts: unknown[] = [];
  const listeners = new Map<string, (event?: { key?: string | null; newValue?: string | null }) => void>();
  let reloads = 0;
  let consent = overrides.consent ?? "granted";
  const context = {
    navigator: { doNotTrack: overrides.dnt, globalPrivacyControl: overrides.gpc },
    location: { origin: "https://rosagiro.com.br", pathname: overrides.pathname || "/produto/example", reload: () => { reloads += 1; } },
    document: { title: "Example", referrer: "https://example.com/?email=private@example.com", createElement: () => ({}), head: { appendChild: (element: unknown) => scripts.push(element) } },
    window: { gtag: (...args: unknown[]) => calls.push(args), dispatchEvent: () => true, addEventListener: (name: string, callback: (event?: { key?: string | null; newValue?: string | null }) => void) => listeners.set(name, callback) },
    localStorage: { getItem: () => { if (overrides.storageBlocked) throw new Error("Blocked"); return consent; } },
    URL,
    Event
  };
  runInNewContext(googleTagBootstrap("AW-17323505855", "G-EXAMPLE"), context);
  return {
    calls,
    scripts,
    reloads: () => reloads,
    navigate: (pathname: string) => { context.location.pathname = pathname; },
    notifyConsent: () => listeners.get("rosagiro:consent-change")?.(),
    grant: () => { consent = "granted"; listeners.get("rosagiro:consent-change")?.(); },
    storage: (key: string, newValue: string | null) => {
      if (key === "rosagiro:google-consent" && (newValue === "granted" || newValue === "denied" || newValue === null)) {
        consent = newValue || "";
      }
      listeners.get("storage")?.({ key, newValue });
    }
  };
}

test("does not load Google tags when tracking is opted out or the page is private", () => {
  for (const option of [{ dnt: "1" }, { gpc: true }, { pathname: "/admin/pedidos" }, { pathname: "/api/orders" }, { pathname: "/pagamento-simulado/RG-123" }]) {
    const result = bootstrapFixture(option);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.scripts, []);
  }
});

test("requires explicit consent and starts only once after opt-in", () => {
  for (const consent of ["", "denied"]) {
    const result = bootstrapFixture({ consent });
    assert.equal(result.calls.length, 0);
    assert.equal(result.scripts.length, 0);
    result.grant();
    result.grant();
    assert.equal(result.scripts.length, 1);
  }
  assert.equal(bootstrapFixture({ storageBlocked: true }).scripts.length, 0);
  const privateBrowser = bootstrapFixture({ gpc: true, consent: "denied" });
  privateBrowser.grant();
  assert.equal(privateBrowser.scripts.length, 0);
});

test("loads valid destinations with manual views and sanitized context", () => {
  const result = bootstrapFixture({ pathname: "/pedido/RG-123" });
  assert.equal(result.scripts.length, 1);
  const configs = result.calls.filter(([command]) => command === "config");
  assert.equal(configs.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(configs[0][2])), {
    send_page_view: false,
    page_location: "https://rosagiro.com.br/pedido",
    page_referrer: "https://example.com/",
    page_title: "Pedido RosaGiro"
  });
  assert.equal(googleTagBootstrap("bad';alert(1)//", "G-<script>"), "");
});

test("storage consent grants start tags and explicit revocation unloads an already loaded tag", () => {
  const lateGrant = bootstrapFixture({ consent: "denied" });
  lateGrant.storage("unrelated", "granted");
  assert.equal(lateGrant.scripts.length, 0);
  lateGrant.storage("rosagiro:google-consent", "unexpected");
  assert.equal(lateGrant.scripts.length, 0);
  assert.equal(lateGrant.reloads(), 0);

  lateGrant.storage("rosagiro:google-consent", "granted");
  assert.equal(lateGrant.scripts.length, 1);
  assert.equal(lateGrant.reloads(), 0);
  lateGrant.storage("unrelated", "denied");
  lateGrant.storage("rosagiro:google-consent", "unexpected");
  assert.equal(lateGrant.reloads(), 0);
  lateGrant.storage("rosagiro:google-consent", "denied");
  assert.equal(lateGrant.reloads(), 1);
});

test("a paid order can wake bootstrap after client navigation from an excluded payment route", () => {
  const result = bootstrapFixture({ consent: "granted", pathname: "/pagamento-simulado/RG-123" });
  assert.equal(result.scripts.length, 0);
  result.navigate("/pedido/RG-123");
  result.notifyConsent();
  assert.equal(result.scripts.length, 1);
});

test("normalizes order and referrer URLs without leaking their identifiers", () => {
  assert.deepEqual(analyticsPageContext({ origin: "https://rosagiro.com.br", pathname: "/pedido/RG-123" }, "Private customer", "https://example.com/?token=secret"), {
    page_location: "https://rosagiro.com.br/pedido",
    page_referrer: "https://example.com/",
    page_title: "Pedido RosaGiro"
  });
  assert.equal(analyticsPageContext({ origin: "https://rosagiro.com.br", pathname: "/admin/leads" }, "Customer", ""), null);
});
