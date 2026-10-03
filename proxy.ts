import { NextRequest, NextResponse } from "next/server";
import { isBlockedCrawler } from "@/lib/crawler-policy";
import { LocalRateLimiter } from "@/lib/local-rate-limit";
import { requestClientIp } from "@/lib/request-client-ip";

type RateLimitRule = {
  prefix: string;
  methods: string[];
  limit: number;
  windowMs: number;
};

const rateLimiter = new LocalRateLimiter();

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

const publicApiRateLimits: RateLimitRule[] = [
  { prefix: "/api/orders", methods: ["POST"], limit: 16, windowMs: 60_000 },
  { prefix: "/api/cart/summary", methods: ["POST"], limit: 120, windowMs: 60_000 },
  { prefix: "/api/shipping/quote", methods: ["POST"], limit: 60, windowMs: 60_000 },
  { prefix: "/api/address/autocomplete", methods: ["POST"], limit: 80, windowMs: 60_000 },
  { prefix: "/api/address/place-details", methods: ["POST"], limit: 50, windowMs: 60_000 },
  { prefix: "/api/address/validate", methods: ["POST"], limit: 60, windowMs: 60_000 },
  { prefix: "/api/customers/session", methods: ["POST"], limit: 40, windowMs: 60_000 },
  { prefix: "/api/analytics/product-events", methods: ["POST"], limit: 180, windowMs: 60_000 },
  { prefix: "/api/analytics/page-views", methods: ["POST"], limit: 240, windowMs: 60_000 },
  { prefix: "/api/analytics/whatsapp-clicks", methods: ["POST"], limit: 120, windowMs: 60_000 },
  { prefix: "/api/admin/search", methods: ["GET"], limit: 80, windowMs: 60_000 },
  { prefix: "/api/admin/notifications", methods: ["GET", "POST"], limit: 120, windowMs: 60_000 }
];

const jsonOnlyApiPaths = [
  "/api/orders",
  "/api/cart/summary",
  "/api/shipping/quote",
  "/api/address/autocomplete",
  "/api/address/place-details",
  "/api/address/validate",
  "/api/customers/session",
  "/api/analytics/product-events",
  "/api/analytics/page-views",
  "/api/analytics/whatsapp-clicks",
  "/api/admin/notifications/read"
];

function atPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedMutation(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const { pathname } = request.nextUrl;
  return atPath(pathname, "/admin") || atPath(pathname, "/api/admin");
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
  return publicApiRateLimits.find((rule) => atPath(pathname, rule.prefix) && rule.methods.includes(request.method));
}

function hasOversizedPublicJsonBody(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  return Number.isFinite(length) && length > 512_000;
}

function hasExpectedJsonContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.split(";", 1)[0].trim().toLowerCase() === "application/json";
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

  // Every crawler must be able to discover robots.txt. This is not an auth/WAF
  // bypass: a claimed Googlebot UA never skips scanner, origin or API checks.
  const readingRobots = pathname === "/robots.txt" && ["GET", "HEAD"].includes(request.method);
  if (!readingRobots && userAgent && isBlockedCrawler(userAgent)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (invalidCatalogQuery(request)) {
    return new NextResponse("Invalid catalog query", { status: 400 });
  }

  if (isProtectedMutation(request) && !isSameOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (jsonOnlyApiPaths.some((path) => atPath(pathname, path)) && request.method === "POST") {
    if (!hasExpectedJsonContentType(request)) {
      return NextResponse.json({ error: "Content-Type invalido." }, { status: 415 });
    }
    if (hasOversizedPublicJsonBody(request)) {
      return NextResponse.json({ error: "Requisicao muito grande." }, { status: 413 });
    }
  }

  const rateLimitRule = matchingRateLimitRule(request);
  const ip = rateLimitRule ? requestClientIp(request.headers) : "unknown";
  // Missing trusted IPs must not put unrelated shoppers in one global bucket.
  // The edge layer can still count connections; admin login fails closed separately.
  if (rateLimitRule && ip !== "unknown") {
    const key = `${rateLimitRule.prefix}:${request.method}:${ip}`;
    const result = rateLimiter.consume(key, rateLimitRule.limit, rateLimitRule.windowMs);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
