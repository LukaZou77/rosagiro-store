import { NextResponse } from "next/server";
import { exchangeOrderShareGrant, setOrderAccessCookie } from "@/lib/order-access";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

const RETURN_STATES = new Set(["success", "pending", "failure"]);

function protectedHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export async function GET(request: Request, context: RouteContext) {
  const { orderNumber } = await context.params;
  const requestUrl = new URL(request.url);
  const grant = requestUrl.searchParams.get("grant");
  const returnState = requestUrl.searchParams.get("mp");
  const cleanUrl = new URL(`/pedido/${encodeURIComponent(orderNumber)}`, requestUrl.origin);
  if (returnState && RETURN_STATES.has(returnState)) cleanUrl.searchParams.set("mp", returnState);

  if (!exchangeOrderShareGrant(orderNumber, grant)) {
    return protectedHeaders(NextResponse.redirect(cleanUrl, 303));
  }

  const response = setOrderAccessCookie(NextResponse.redirect(cleanUrl, 303), orderNumber);
  return protectedHeaders(response);
}
