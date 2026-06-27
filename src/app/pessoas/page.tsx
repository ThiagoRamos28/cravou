import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarUsuarios } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { UsuariosList } from "@/components/pessoas/usuarios-list";

export default async function PessoasPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const usuarios = await listarUsuarios(sessao.userId);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Pessoas
        </h1>
        <UsuariosList usuarios={usuarios} />
      </main>
      <SiteFooter />
    </div>
  );
}
