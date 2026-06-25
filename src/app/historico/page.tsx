import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Resumo } from "@/components/historico/resumo";
import { HistoricoItem } from "@/components/historico/historico-item";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";
import { listarMeusPalpites } from "@/lib/predictions";
import { resumoHistorico, type ItemHistorico } from "@/lib/historico";

const PTS_MAXIMO = 10; // pts_placar_exato (default)

export default async function HistoricoPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [jogos, palpites] = await Promise.all([listarJogos(), listarMeusPalpites()]);

  const itens: ItemHistorico[] = jogos
    .filter((j) => j.status === "finalizado" && palpites[j.id])
    .map((j) => {
      const p = palpites[j.id];
      return {
        match: j,
        palpiteCasa: p.palpite_casa,
        palpiteFora: p.palpite_fora,
        pontos: p.pontos ?? 0,
      };
    })
    .sort((a, b) => b.match.inicio_em.localeCompare(a.match.inicio_em));

  const resumo = resumoHistorico(itens, PTS_MAXIMO);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Meu histórico
        </h1>
        {itens.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
            Você ainda não tem jogos encerrados com palpite. Seu histórico aparece
            aqui conforme os jogos terminam.
          </p>
        ) : (
          <>
            <Resumo {...resumo} />
            <div className="flex flex-col gap-3">
              {itens.map((item) => (
                <HistoricoItem key={item.match.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
