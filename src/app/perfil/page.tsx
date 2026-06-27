import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth/profile";
import { avatarPadrao } from "@/lib/avatars";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ApelidoForm } from "@/components/perfil/apelido-form";
import { AvatarForm } from "@/components/perfil/avatar-form";
import { SenhaForm } from "@/components/perfil/senha-form";

export default async function PerfilPage() {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Meu Perfil
        </h1>
        <div className="flex flex-col gap-6">
          <ApelidoForm apelidoAtual={perfil.apelido ?? ""} />
          <AvatarForm
            avatarAtual={perfil.avatar_url ?? avatarPadrao(perfil.id)}
          />
          <SenhaForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
