import { NextResponse } from "next/server";
import { autocompleteAddress } from "@/lib/google-address";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { input?: string; sessionToken?: string };
    const result = await autocompleteAddress(payload.input || "", payload.sessionToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "ERROR",
        suggestions: [],
        message: "Nao foi possivel buscar sugestoes agora. Preencha manualmente."
      },
      { status: 500 }
    );
  }
}
