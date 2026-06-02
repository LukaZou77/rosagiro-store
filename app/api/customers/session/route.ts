import { NextResponse } from "next/server";
import { CustomerSessionError, parseCustomerSessionPayload, upsertCustomerSession } from "@/lib/customers";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const input = parseCustomerSessionPayload(payload);
    const customer = await upsertCustomerSession(input);

    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof CustomerSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json({ error: "Nao foi possivel iniciar o atendimento agora." }, { status: 500 });
  }
}
