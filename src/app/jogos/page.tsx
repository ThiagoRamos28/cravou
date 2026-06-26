import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, listarFasesERodadas } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";

export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; rodada?: string; soAbertos?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const { fase, rodada, soAbertos } = await searchParams;
  const soAbertosAtivo = soAbertos === "1";
  const fases = await listarFasesERodadas();

  const faseAtiva = fase ?? fases[0]?.fase ?? "";
  const rodadaAtiva = rodada ?? "";

  const minutosCorte = await getMinutosCorte();
  const [jogos, palpites] = await Promise.all([
    listarJogos({
      fase: faseAtiva || undefined,
      rodada: rodadaAtiva || undefined,
      soAbertos: soAbertosAtivo,
      minutosCorte,
    }),
    listarMeusPalpites(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Jogos da Copa
        </h1>
        {fases.length > 0 && (
          <JogosFiltro
            fases={fases}
            faseAtiva={faseAtiva}
            rodadaAtiva={rodadaAtiva}
            soAbertos={soAbertosAtivo}
          />
        )}
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            {soAbertosAtivo
              ? "Nenhum jogo aberto para palpite no momento."
              : "Nenhum jogo neste recorte. Ajuste o filtro acima."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {jogos.map((j) => (
              <MatchCard
                key={j.id}
                match={j}
                palpite={palpites[j.id]}
                minutosCorte={minutosCorte}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
