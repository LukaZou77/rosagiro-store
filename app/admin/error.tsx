"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="admin-error-screen">
      <section>
        <span><AlertTriangle size={24} /></span>
        <p>Não foi possível carregar esta área.</p>
        <h1>O painel encontrou um erro</h1>
        <button type="button" onClick={reset}><RotateCcw size={16} />Tentar novamente</button>
      </section>
    </main>
  );
}
