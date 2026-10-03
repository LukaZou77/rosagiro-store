import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

// Vercel overwrites these headers at ingress. Do not trust arbitrary forwarding
// headers on a self-hosted server unless its reverse proxy strips client values.
export function requestClientIp(headers: HeaderReader, vercel = process.env.VERCEL === "1") {
  const raw = vercel
    ? headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
    : process.env.NODE_ENV !== "production"
      ? headers.get("x-forwarded-for") || headers.get("x-real-ip")
      : null;
  const candidate = raw?.trim() || "";
  // A comma-separated, malformed or missing value must not create arbitrary buckets.
  const version = isIP(candidate);
  if (!version) return "unknown";
  if (version === 4) return candidate;
  // Equivalent IPv6 spellings must share a bucket.
  return new URL(`http://[${candidate}]/`).hostname.slice(1, -1).toLowerCase();
}
