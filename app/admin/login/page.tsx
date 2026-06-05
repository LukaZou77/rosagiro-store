import Link from "next/link";
import { loginAction } from "@/app/admin/actions";
import { getAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const [admin, params] = await Promise.all([getAdmin(), searchParams]);
  if (admin) redirect("/admin");
  const hasError = Boolean(params.error);

  return (
    <main className="login-screen">
      <form action={loginAction} className="checkout-form login-card">
        <p className="eyebrow">Bela Viva Admin</p>
        <h1>Entrar</h1>
        <label>
          E-mail
          <input name="email" type="email" defaultValue="admin@belaviva.local" required />
        </label>
        <label>
          Senha
          <input name="password" type="password" required />
        </label>
        <div className="form-error" role="alert">
          {hasError ? "E-mail ou senha inválidos." : ""}
        </div>
        <button className="button primary wide" type="submit">
          Acessar admin
        </button>
        <Link className="back-link" href="/">
          Voltar para loja
        </Link>
      </form>
    </main>
  );
}
