import { NextResponse } from "next/server";
import { getAddressPlaceDetails, getViaCepPlaceDetails } from "@/lib/google-address";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { placeId?: string; sessionToken?: string };
    const viaCepResult = await getViaCepPlaceDetails(payload.placeId || "");
    const result = viaCepResult || (await getAddressPlaceDetails(payload.placeId || "", payload.sessionToken));
    const status = result.status === "ERROR" ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Nao foi possivel carregar o endereco selecionado. Preencha manualmente."
      },
      { status: 500 }
    );
  }
}
