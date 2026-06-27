import { redirect, notFound } from "next/navigation";
import { getSessao, getPerfilPublico } from "@/lib/auth/profile";
import {
  getMetricasSociais,
  getSeguidores,
  getSeguindo,
  getUltimosPalpites,
  isSeguindo as checkIsSeguindo,
} from "@/lib/feed";
import { avatarPadrao } from "@/lib/avatars";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MetricasSociais } from "@/components/perfil/metricas-sociais";
import { PalpitesGrid } from "@/components/perfil/palpites-grid";
import { FollowButton } from "@/components/perfil/follow-button";

type Props = { params: Promise<{ id: string }> };

export default async function PerfilPublicoPage({ params }: Props) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (id === sessao.userId) redirect("/perfil");

  const [perfil, metricas, seguidores, seguindo, palpites, jaSeguindo] =
    await Promise.all([
      getPerfilPublico(id),
      getMetricasSociais(id),
      getSeguidores(id),
      getSeguindo(id),
      getUltimosPalpites(id),
      checkIsSeguindo(sessao.userId, id),
    ]);

  if (!perfil) notFound();

  const avatarUrl = perfil.avatar_url ?? avatarPadrao(perfil.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <img
            src={avatarUrl}
            alt={perfil.apelido ?? ""}
            width={72}
            height={72}
            className="rounded-full border-2 border-border"
          />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
              {perfil.apelido ?? "Usuário"}
            </h1>
            <MetricasSociais
              seguidores={metricas.seguidores}
              seguindo={metricas.seguindo}
              listaSeguidores={seguidores}
              listaSeguindo={seguindo}
            />
            <FollowButton followingId={id} isSeguindoInicial={jaSeguindo} />
          </div>
        </div>

        <section>
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
