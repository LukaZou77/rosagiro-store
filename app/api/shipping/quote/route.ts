import { NextResponse } from "next/server";
import { getShippingQuoteForCart, type ShippingQuoteCartItem } from "@/lib/shipping";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { items?: ShippingQuoteCartItem[]; cep?: string };
    const quote = await getShippingQuoteForCart(Array.isArray(payload.items) ? payload.items : [], String(payload.cep || ""));
    return NextResponse.json(quote);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Nao foi possivel calcular o frete agora. Preencha o endereco e fale no WhatsApp se necessario.",
        options: [],
        productWeightGrams: 0,
        billableWeightGrams: 0
      },
      { status: 500 }
    );
  }
}
