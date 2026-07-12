import Link from "next/link";
import { SearchX } from "lucide-react";

export default function AdminNotFound() {
  return (
    <main className="admin-error-screen">
      <section>
        <span><SearchX size={24} /></span>
        <p>Área administrativa</p>
        <h1>Página não encontrada</h1>
        <Link href="/admin" prefetch={false}>Voltar ao dashboard</Link>
      </section>
    </main>
  );
}
