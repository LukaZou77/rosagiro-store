import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import {
  createOrderAccessGrant,
  createOrderShareGrant,
  orderAccessCookieName,
  ORDER_ACCESS_COOKIE_DAYS,
  verifyOrderAccessGrant,
  verifyOrderShareGrant
} from "@/lib/order-access-core";

function sessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return secret;
}

function cookieValueFromHeader(header: string | null, name: string) {
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: ORDER_ACCESS_COOKIE_DAYS * 24 * 60 * 60,
    path: "/"
  };
}

export function assertOrderAccessConfigured() {
  sessionSecret();
}

export function setOrderAccessCookie(response: NextResponse, orderNumber: string) {
  const secret = sessionSecret();
  response.cookies.set(orderAccessCookieName(orderNumber, secret), createOrderAccessGrant(orderNumber, secret), cookieOptions());
  return response;
}

export async function hasOrderAccess(orderNumber: string) {
  try {
    const secret = sessionSecret();
    const jar = await cookies();
    const cookieName = orderAccessCookieName(orderNumber, secret);
    if (verifyOrderAccessGrant(orderNumber, jar.get(cookieName)?.value, secret)) return true;
    return Boolean(await getAdmin());
  } catch {
    return false;
  }
}

export async function hasOrderRequestAccess(request: Request, orderNumber: string) {
  try {
    const secret = sessionSecret();
    const cookieName = orderAccessCookieName(orderNumber, secret);
    const value = cookieValueFromHeader(request.headers.get("cookie"), cookieName);
    if (verifyOrderAccessGrant(orderNumber, value, secret)) return true;
    return Boolean(await getAdmin());
  } catch {
    return false;
  }
}

export function createAdminOrderSharePath(orderNumber: string) {
  const token = createOrderShareGrant(orderNumber, sessionSecret());
  return `/pedido/acesso/${encodeURIComponent(orderNumber)}?grant=${encodeURIComponent(token)}`;
}

export function exchangeOrderShareGrant(orderNumber: string, token: string | null | undefined) {
  try {
    return verifyOrderShareGrant(orderNumber, token, sessionSecret());
  } catch {
    return false;
  }
}
