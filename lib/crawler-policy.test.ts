import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOCKED_CRAWLER_USER_AGENT_TOKENS,
  ROBOTS_ALLOWED_CRAWLER_USER_AGENTS,
  ROBOTS_BLOCKED_CRAWLER_USER_AGENTS,
  isBlockedCrawler
} from "@/lib/crawler-policy";

test("keeps search and user-fetch crawlers out of the blocked policy", () => {
  const blocked = new Set(ROBOTS_BLOCKED_CRAWLER_USER_AGENTS.map((token) => token.toLowerCase()));

  for (const userAgent of ROBOTS_ALLOWED_CRAWLER_USER_AGENTS) {
    assert.equal(blocked.has(userAgent.toLowerCase()), false, `${userAgent} must not be blocked`);
    assert.equal(isBlockedCrawler(userAgent), false, `${userAgent} must be allowed`);
  }
});

test("blocks training, commercial, and scanner tokens on token boundaries", () => {
  for (const token of BLOCKED_CRAWLER_USER_AGENT_TOKENS) {
    assert.equal(isBlockedCrawler(`Mozilla/5.0 (compatible; ${token}/1.0)`), true, token);
  }

  assert.equal(isBlockedCrawler("Mozilla/5.0 notgptbot/1.0"), false);
  assert.equal(isBlockedCrawler("Mozilla/5.0 sqlmapper/1.0"), false);
});

test("does not let an allowed crawler identity bypass a blocked token", () => {
  assert.equal(isBlockedCrawler("Mozilla/5.0 Googlebot/2.1 sqlmap/1.8"), true);
  assert.equal(isBlockedCrawler("ChatGPT-User/1.0 (compatible; ClaudeBot/1.0)"), true);
});

test("does not block ordinary clients through generic substrings", () => {
  assert.equal(isBlockedCrawler("Mozilla/5.0 Chrome/140.0"), false);
  assert.equal(isBlockedCrawler("curl/8.16.0"), false);
  assert.equal(isBlockedCrawler("python-requests/2.32.0"), false);
  assert.equal(isBlockedCrawler(null), false);
});
