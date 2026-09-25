import { NextResponse } from "next/server";
import { separateFreightNotice } from "@/lib/freight-policy";

// Retired checkout endpoint: even an old client must not request carrier prices.
export async function POST() {
  return NextResponse.json(
    {
      status: "SEPARATE_PAYMENT",
      message: `${separateFreightNotice} Atualize a página para continuar o pagamento dos produtos.`,
      options: [],
      productWeightGrams: 0,
      billableWeightGrams: 0
    },
    { status: 410 }
  );
}
