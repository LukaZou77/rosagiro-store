import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/admin/actions";
import { AdminLanguageSwitch } from "@/components/AdminLanguageProvider";
import { getAdmin, rememberedAdminEmail } from "@/lib/auth";
import { adminReturnPath } from "@/lib/admin-login-return";
import { createAdminTranslator } from "@/lib/admin-i18n";
import { getAdminLocale } from "@/lib/admin-i18n-server";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const [admin, params, locale, email] = await Promise.all([getAdmin(), searchParams, getAdminLocale(), rememberedAdminEmail()]);
  const returnTo = adminReturnPath(Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo);
  if (admin) redirect(returnTo);
  const t = createAdminTranslator(locale);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="admin-login-screen">
      <section className="admin-login-identity" aria-label={t("RosaGiro Operações", "RosaGiro 运营后台")}>
        <div className="admin-login-brand"><span>RG</span><div><strong>RosaGiro</strong><small>{t("Operações", "运营后台")}</small></div></div>
        <div className="admin-login-message"><ShieldCheck size={28} /><h1>{t("Gestão da loja em um só lugar", "一个后台，掌握店铺运营")}</h1><p>{t("Acesso reservado à equipe responsável por pedidos, catálogo e atendimento.", "仅供负责订单、商品目录与客户服务的运营人员使用。")}</p></div>
      </section>
      <section className="admin-login-form-panel">
        <form action={loginAction} className="admin-login-card">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="admin-login-language"><AdminLanguageSwitch /></div>
          <span className="admin-login-lock"><LockKeyhole size={21} /></span>
          <div><p>{t("Área administrativa", "管理区域")}</p><h2>{t("Entrar", "登录")}</h2></div>
          <label>{t("E-mail", "邮箱")}<input name="email" type="email" autoComplete="username" defaultValue={email} placeholder="seu@email.com" required /></label>
          <label>{t("Senha", "密码")}<input name="password" type="password" autoComplete="current-password" required /></label>
          {error ? <div className="admin-login-error" role="alert">{error === "session"
            ? t("Sua sessão terminou. Entre novamente e envie a atualização do pedido.", "登录已失效，本次更新未保存。请重新登录后再次提交。")
            : error === "rate" ? t("Muitas tentativas. Aguarde antes de tentar novamente.", "尝试次数过多，请稍后再试。")
            : t("E-mail ou senha inválidos.", "邮箱或密码不正确。")}</div> : null}
          <button type="submit">{t("Acessar admin", "进入后台")}</button>
          <Link href="/" prefetch={false}>{t("Voltar para a loja", "返回前台店铺")}</Link>
        </form>
      </section>
    </main>
  );
}
