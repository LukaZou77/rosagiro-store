import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/admin/actions";
import { getAdmin } from "@/lib/auth";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([getAdmin(), searchParams]);
  if (admin) redirect("/admin");
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="admin-login-screen">
      <section className="admin-login-identity" aria-label="RosaGiro Operações">
        <div className="admin-login-brand"><span>RG</span><div><strong>RosaGiro</strong><small>Operações</small></div></div>
        <div className="admin-login-message"><ShieldCheck size={28} /><h1>Gestão da loja em um só lugar</h1><p>Acesso reservado à equipe responsável por pedidos, catálogo e atendimento.</p></div>
      </section>
      <section className="admin-login-form-panel">
        <form action={loginAction} className="admin-login-card">
          <span className="admin-login-lock"><LockKeyhole size={21} /></span>
          <div><p>Área administrativa</p><h2>Entrar</h2></div>
          <label>E-mail<input name="email" type="email" autoComplete="username" placeholder="seu@email.com" required /></label>
          <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
          {error ? <div className="admin-login-error" role="alert">E-mail ou senha inválidos.</div> : null}
          <button type="submit">Acessar admin</button>
          <Link href="/">Voltar para a loja</Link>
        </form>
      </section>
    </main>
  );
}
