import { NextResponse } from "next/server";
import { MercadoPagoError, processMercadoPagoWebhook } from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const result = await processMercadoPagoWebhook(request, payload as { id?: string; type?: string; action?: string; data?: { id?: string } });
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      return NextResponse.json({ ok: false, status: "MERCADO_PAGO_ERROR", error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ ok: false, status: "WEBHOOK_ERROR" }, { status: 500 });
  }
}
