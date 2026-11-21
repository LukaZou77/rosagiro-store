import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "@/next.config";

test("redirects the www host permanently to the canonical domain", async () => {
  assert.equal(typeof nextConfig.redirects, "function");
  const redirects = await nextConfig.redirects!();
  const canonicalHostRedirect = redirects.find((redirect) =>
    redirect.has?.some((condition) => condition.type === "host" && condition.value === "www.rosagiro.com.br")
  );

  assert.equal(canonicalHostRedirect?.destination, "https://rosagiro.com.br/:path*");
  assert.equal(canonicalHostRedirect?.permanent, true);
});

test("sends noindex headers on customer transaction routes", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const headerRules = await nextConfig.headers!();
  const expectedSources = ["/carrinho", "/checkout", "/pedido/:path*", "/pagamento-simulado/:path*"];

  for (const source of expectedSources) {
    const rule = headerRules.find((item) => item.source === source);
    const robotsHeader = rule?.headers.find((header) => header.key === "X-Robots-Tag");
    assert.equal(robotsHeader?.value, "noindex, nofollow, noarchive", source);
  }
});

test("allows ViaCEP address lookup only through the global connect CSP directive", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const headerRules = await nextConfig.headers!();
  const globalRule = headerRules.find((rule) => rule.source === "/:path*");
  const csp = globalRule?.headers.find((header) => header.key === "Content-Security-Policy")?.value;
  const directives = new Map((csp ?? "").split("; ").map((directive) => {
    const [name, ...sources] = directive.split(" ");
    return [name, sources] as const;
  }));

  assert.deepEqual(directives.get("connect-src")?.filter((source) => source.includes("viacep")), ["https://viacep.com.br"]);
  assert.equal(directives.get("script-src")?.some((source) => source.includes("viacep")), false);
});
