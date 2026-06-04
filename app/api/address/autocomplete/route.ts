import { NextResponse } from "next/server";
import { autocompleteAddress, autocompleteViaCepAddress, hasGoogleAddressApiKey } from "@/lib/google-address";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { input?: string; sessionToken?: string; state?: string; city?: string };
    const result = hasGoogleAddressApiKey()
      ? await autocompleteAddress(payload.input || "", payload.sessionToken)
      : await autocompleteViaCepAddress({
          input: payload.input || "",
          state: payload.state,
          city: payload.city
        });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "ERROR",
        suggestions: [],
        message: "Não foi possível buscar sugestões agora. Preencha manualmente."
      },
      { status: 500 }
    );
  }
}
