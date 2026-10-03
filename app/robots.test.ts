import assert from "node:assert/strict";
import test from "node:test";
import robots from "@/app/robots";
import {
  ROBOTS_ALLOWED_CRAWLER_USER_AGENTS,
  ROBOTS_BLOCKED_CRAWLER_USER_AGENTS,
  ROBOTS_PRIVATE_PATHS
} from "@/lib/crawler-policy";

function userAgents(value: string | string[] | undefined) {
  assert.ok(value);
  return Array.isArray(value) ? value : [value];
}

test("publishes disjoint allow and block crawler groups", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const allowedRule = rules.find((rule) =>
    userAgents(rule.userAgent).includes(ROBOTS_ALLOWED_CRAWLER_USER_AGENTS[0])
  );
  const blockedRule = rules.find((rule) =>
    userAgents(rule.userAgent).includes(ROBOTS_BLOCKED_CRAWLER_USER_AGENTS[0])
  );

  assert.ok(allowedRule);
  assert.ok(blockedRule);
  assert.deepEqual(userAgents(allowedRule.userAgent), [...ROBOTS_ALLOWED_CRAWLER_USER_AGENTS]);
  assert.deepEqual(userAgents(blockedRule.userAgent), [...ROBOTS_BLOCKED_CRAWLER_USER_AGENTS]);

  const allowed = new Set(userAgents(allowedRule.userAgent).map((value) => value.toLowerCase()));
  for (const blockedUserAgent of userAgents(blockedRule.userAgent)) {
    assert.equal(allowed.has(blockedUserAgent.toLowerCase()), false, blockedUserAgent);
  }
});

test("keeps private paths disallowed for allowed crawlers and the default rule", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const allowedRule = rules.find((rule) =>
    userAgents(rule.userAgent).includes(ROBOTS_ALLOWED_CRAWLER_USER_AGENTS[0])
  );
  const defaultRule = rules.find((rule) => rule.userAgent === "*");

  assert.ok(allowedRule);
  assert.ok(defaultRule);
  assert.equal(allowedRule.allow, "/");
  assert.equal(defaultRule.allow, "/");
  assert.deepEqual(allowedRule.disallow, [...ROBOTS_PRIVATE_PATHS]);
  assert.deepEqual(defaultRule.disallow, [...ROBOTS_PRIVATE_PATHS]);
});

test("keeps blocked crawlers fully disallowed and Perplexity available for search", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const blockedRule = rules.find((rule) =>
    userAgents(rule.userAgent).includes(ROBOTS_BLOCKED_CRAWLER_USER_AGENTS[0])
  );
  const allowedRule = rules.find((rule) =>
    userAgents(rule.userAgent).includes("PerplexityBot")
  );

  assert.ok(blockedRule);
  assert.ok(allowedRule);
  assert.equal(blockedRule.disallow, "/");
  assert.equal(userAgents(blockedRule.userAgent).includes("PerplexityBot"), false);
  assert.equal(userAgents(allowedRule.userAgent).includes("Perplexity-User"), true);
});
