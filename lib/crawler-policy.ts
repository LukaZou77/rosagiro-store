export const ROBOTS_PRIVATE_PATHS = ["/admin", "/api"] as const;

export const ROBOTS_ALLOWED_CRAWLER_USER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Slurp",
  "YandexBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User"
] as const;

export const ROBOTS_BLOCKED_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "Bytespider",
  "PetalBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "anthropic-ai",
  "Applebot-Extended",
  "DotBot"
] as const;

export const BLOCKED_CRAWLER_USER_AGENT_TOKENS = [
  ...ROBOTS_BLOCKED_CRAWLER_USER_AGENTS,
  "sqlmap",
  "nikto",
  "masscan",
  "zgrab",
  "HTTrack",
  "Scrapy"
] as const;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const blockedCrawlerPatterns = BLOCKED_CRAWLER_USER_AGENT_TOKENS.map(
  (token) => new RegExp(`(^|[^a-z0-9])${escapeRegularExpression(token)}(?=$|[^a-z0-9])`, "i")
);

export function isBlockedCrawler(userAgent: string | null | undefined) {
  if (!userAgent) {
    return false;
  }

  return blockedCrawlerPatterns.some((pattern) => pattern.test(userAgent));
}
