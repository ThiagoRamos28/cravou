import { redirect } from "next/navigation";
import { getPerfil, getSessao } from "@/lib/auth/profile";
import {
  getMetricasSociais,
  getSeguidores,
  getSeguindo,
  getUltimosPalpites,
} from "@/lib/feed";
import { avatarPadrao } from "@/lib/avatars";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ApelidoForm } from "@/components/perfil/apelido-form";
import { AvatarForm } from "@/components/perfil/avatar-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { MetricasSociais } from "@/components/perfil/metricas-sociais";
import { PalpitesGrid } from "@/components/perfil/palpites-grid";

export default async function PerfilPage() {
  const [perfil, sessao] = await Promise.all([getPerfil(), getSessao()]);
  if (!perfil || !sessao) redirect("/entrar");

  const [metricas, seguidores, seguindo, palpites] = await Promise.all([
    getMetricasSociais(perfil.id),
    getSeguidores(perfil.id),
    getSeguindo(perfil.id),
    getUltimosPalpites(perfil.id),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight">
          Meu Perfil
        </h1>
        <div className="mb-8">
          <MetricasSociais
            seguidores={metricas.seguidores}
            seguindo={metricas.seguindo}
            listaSeguidores={seguidores}
            listaSeguindo={seguindo}
          />
        </div>
        <div className="flex flex-col gap-6">
          <ApelidoForm apelidoAtual={perfil.apelido ?? ""} />
          <AvatarForm
            avatarAtual={perfil.avatar_url ?? avatarPadrao(perfil.id)}
          />
          <SenhaForm />
        </div>
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-tight">
            Últimos palpites
          </h2>
          <PalpitesGrid palpites={palpites} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
