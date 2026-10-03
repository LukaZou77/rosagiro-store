import assert from "node:assert/strict";
import { test } from "node:test";
import rules from "./waf-observe-rules.json";

function matches(rule: typeof rules[number], path: string, method: string) {
  return rule.conditions.every((condition) => {
    const actual = condition.type === "path" ? path : method;
    if (condition.op === "eq") return actual === condition.value;
    if (condition.op === "inc") return (condition.value as string[]).includes(actual);
    if (condition.op === "re") return new RegExp(condition.value as string).test(actual);
    throw new Error("Unexpected rule operation");
  });
}

test("WAF rollout is observe-only and contains no broad bypass or UA exemption", () => {
  assert.equal(rules.length, 3);
  for (const rule of rules) {
    assert.equal(rule.exceedAction, "log");
    assert.equal(rule.key, "ip");
    assert.ok(rule.requests >= 60);
    assert.equal(rule.windowSeconds, 60);
    assert.ok(rule.conditions.every((condition) => ["path", "method"].includes(condition.type)));
  }
});

test("catalog observations exclude crawl discovery, assets and transactional routes", () => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/_next/static/main.js", "/carrinho", "/checkout", "/pedido/1", "/api/webhooks/mercado-pago", "/api/cron/analytics-retention"]) {
    for (const method of ["GET", "HEAD", "POST"]) {
      assert.equal(rules.some((rule) => matches(rule, path, method)), false, `${method} ${path}`);
    }
  }
  assert.equal(matches(rules[0], "/produto/lip-oil", "GET"), true);
  assert.equal(matches(rules[0], "/produto/lip-oil", "POST"), false);
});

test("commerce and login rules match only selected POST requests", () => {
  for (const path of ["/api/orders", "/api/address/autocomplete", "/api/address/place-details"]) {
    assert.equal(matches(rules[1], path, "POST"), true);
    assert.equal(matches(rules[1], path, "GET"), false);
  }
  assert.equal(matches(rules[1], "/api/orders/1/simulate-payment", "POST"), false);
  assert.equal(matches(rules[2], "/admin/login", "POST"), true);
  assert.equal(matches(rules[2], "/admin/login", "GET"), false);
});
