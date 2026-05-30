"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SimulatePaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/orders/${orderNumber}/simulate-payment`, { method: "POST" });
    const result = (await response.json()) as { ok?: boolean; error?: string };
    setLoading(false);

    if (!response.ok || !result.ok) {
      setError(result.error || "Nao foi possivel confirmar o pagamento.");
      return;
    }

    router.push(`/pedido/${orderNumber}`);
  }

  return (
    <>
      <button className="button primary" type="button" onClick={pay} disabled={loading}>
        {loading ? "Confirmando..." : "Confirmar pagamento simulado"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
