import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";
import { palpiteAberto } from "@/lib/palpites/corte";

export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ soAbertos?: string; encerrados?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const { soAbertos, encerrados } = await searchParams;
  const soEncerradosAtivo = encerrados === "1";
  // Padrão: mostrar jogos abertos/ao vivo, a menos que o usuário opte por ver todos (?soAbertos=0)
  const soAbertosAtivo = !soEncerradosAtivo && soAbertos !== "0";

  const minutosCorte = await getMinutosCorte();
  const [jogos, palpites] = await Promise.all([
    listarJogos({
      soAbertos: soAbertosAtivo,
      soEncerrados: soEncerradosAtivo,
      minutosCorte,
    }),
    listarMeusPalpites(),
  ]);

  const agora = Date.now();
  const jogosAbertosCount = soAbertosAtivo
    ? jogos.length
    : jogos.filter(
        (j) =>
          j.status !== "finalizado" &&
          (j.status === "ao_vivo" ||
            palpiteAberto(j.inicio_em, minutosCorte) ||
            new Date(j.inicio_em).getTime() <= agora)
      ).length;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Jogos da Copa
        </h1>
        <JogosFiltro
          soAbertos={soAbertosAtivo}
          soEncerrados={soEncerradosAtivo}
          jogosAbertosCount={jogosAbertosCount}
        />
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            {soAbertosAtivo
              ? "Nenhum jogo aberto para palpite no momento."
              : soEncerradosAtivo
                ? "Nenhum jogo encerrado ainda."
                : "Nenhum jogo encontrado."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
