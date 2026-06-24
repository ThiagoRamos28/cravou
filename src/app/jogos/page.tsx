import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";

export default async function JogosPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const jogos = await listarJogos();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Jogos da Copa
        </h1>
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            Os jogos aparecem aqui assim que forem sincronizados.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {jogos.map((j) => (
              <MatchCard key={j.id} match={j} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
