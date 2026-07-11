import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitRule = {
  prefix: string;
  methods: string[];
  limit: number;
  windowMs: number;
};

const rateBuckets = new Map<string, Bucket>();

const blockedScannerPaths = [
  /^\/\.env(?:[./-].*)?$/i,
  /^\/\.git(?:\/|$)/i,
  /^\/wp-admin(?:\/|$)/i,
  /^\/wp-login\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/phpmyadmin(?:\/|$)/i,
  /^\/pma(?:\/|$)/i,
  /^\/adminer(?:\.php)?$/i,
  /^\/vendor\/phpunit(?:\/|$)/i,
  /^\/cgi-bin(?:\/|$)/i
];

const knownSearchBots = [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "slurp",
  "yandexbot"
];

const blockedBotUserAgents = [
  "bytespider",
  "ccbot",
  "claudebot",
  "gptbot",
  "perplexitybot",
  "anthropic-ai",
  "applebot-extended",
  "semrushbot",
  "mj12bot",
  "petalbot",
  "ahrefsbot",
  "dotbot",
  "sqlmap",
  "nikto",
  "masscan",
  "zgrab",
  "httrack",
  "scrapy"
];

const publicApiRateLimits: RateLimitRule[] = [
  { prefix: "/api/orders", methods: ["POST"], limit: 16, windowMs: 60_000 },
  { prefix: "/api/cart/summary", methods: ["POST"], limit: 120, windowMs: 60_000 },
  { prefix: "/api/shipping/quote", methods: ["POST"], limit: 60, windowMs: 60_000 },
  { prefix: "/api/address/autocomplete", methods: ["GET"], limit: 80, windowMs: 60_000 },
  { prefix: "/api/address/place-details", methods: ["GET"], limit: 50, windowMs: 60_000 },
  { prefix: "/api/address/validate", methods: ["POST"], limit: 60, windowMs: 60_000 },
  { prefix: "/api/customers/session", methods: ["POST"], limit: 40, windowMs: 60_000 },
  { prefix: "/api/analytics/product-events", methods: ["POST"], limit: 180, windowMs: 60_000 },
  { prefix: "/api/analytics/page-views", methods: ["POST"], limit: 240, windowMs: 60_000 }
];

const jsonOnlyApiPaths = [
  "/api/orders",
  "/api/cart/summary",
  "/api/shipping/quote",
  "/api/address/validate",
  "/api/customers/session",
  "/api/analytics/product-events",
  "/api/analytics/page-views"
];

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooManyRequests(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

function isKnownSearchBot(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  return knownSearchBots.some((bot) => normalized.includes(bot));
}

function isBlockedBot(userAgent: string) {
  const normalized = userAgent.toLowerCase();
  return blockedBotUserAgents.some((bot) => normalized.includes(bot));
}

function isProtectedMutation(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const { pathname } = request.nextUrl;
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const requestHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
  if (!requestHost) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    return originHost === requestHost;
  } catch {
    return false;
  }
}

function matchingRateLimitRule(request: NextRequest) {
  const { pathname } = request.nextUrl;
  return publicApiRateLimits.find((rule) => pathname.startsWith(rule.prefix) && rule.methods.includes(request.method));
}

function hasOversizedPublicJsonBody(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  return Number.isFinite(length) && length > 512_000;
}

function hasExpectedJsonContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("application/json");
}

function invalidCatalogQuery(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (!(pathname.startsWith("/categoria") || pathname.startsWith("/marcas") || pathname.startsWith("/promocoes"))) {
    return false;
  }

  const page = Number(searchParams.get("page") || "1");
  if (Number.isFinite(page) && page > 250) return true;

  const search = searchParams.get("q") || searchParams.get("busca") || searchParams.get("search") || "";
  return search.length > 100;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";

  if (blockedScannerPaths.some((pattern) => pattern.test(pathname))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (userAgent && !isKnownSearchBot(userAgent) && isBlockedBot(userAgent)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (invalidCatalogQuery(request)) {
    return new NextResponse("Invalid catalog query", { status: 400 });
  }

  if (isProtectedMutation(request) && !isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (jsonOnlyApiPaths.some((path) => pathname.startsWith(path)) && request.method === "POST") {
    if (!hasExpectedJsonContentType(request)) {
      return NextResponse.json({ error: "Content-Type invalido." }, { status: 415 });
    }
    if (hasOversizedPublicJsonBody(request)) {
      return NextResponse.json({ error: "Requisicao muito grande." }, { status: 413 });
    }
  }

  const rateLimitRule = matchingRateLimitRule(request);
  if (rateLimitRule) {
    const key = `${rateLimitRule.prefix}:${request.method}:${clientIp(request)}`;
    if (tooManyRequests(key, rateLimitRule.limit, rateLimitRule.windowMs)) {
      return NextResponse.json({ error: "Muitas requisicoes. Tente novamente em instantes." }, { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
