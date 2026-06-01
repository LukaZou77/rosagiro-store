import { NextResponse } from "next/server";
import { validateCheckoutAddress } from "@/lib/google-address";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      cep?: string;
      state?: string;
      city?: string;
      district?: string;
      street?: string;
      number?: string;
      complement?: string;
    };

    const result = await validateCheckoutAddress({
      cep: payload.cep || "",
      state: payload.state || "",
      city: payload.city || "",
      district: payload.district || "",
      street: payload.street || "",
      number: payload.number || "",
      complement: payload.complement || ""
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "FAILED",
        provider: "GOOGLE_ADDRESS_VALIDATION",
        formattedAddress: null,
        placeId: null,
        granularity: null,
        latitude: null,
        longitude: null,
        message: "Nao foi possivel validar o endereco agora.",
        checkedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
