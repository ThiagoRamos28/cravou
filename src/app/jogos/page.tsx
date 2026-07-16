import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { NovidadesModal } from "@/components/novidades-modal";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

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

  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
  const participando = atual ? optIns.includes(atual.slug) : false;

  const minutosCorte = await getMinutosCorte();
  const [jogos, palpites] = await Promise.all([
    atual
      ? listarJogos({
          soAbertos: soAbertosAtivo,
          soEncerrados: soEncerradosAtivo,
          minutosCorte,
          competicaoId: atual.id,
        })
      : Promise.resolve([]),
    listarMeusPalpites(),
  ]);


  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <NovidadesModal />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          {atual?.nome ?? "Jogos"}
        </h1>
        {!participando ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="mb-3 text-muted-foreground">
              Você ainda não está participando de{" "}
              <strong className="text-foreground">{atual?.nome}</strong>.
            </p>
            <a
              href="/perfil/competicoes"
              className="font-display font-semibold uppercase tracking-tight text-accent hover:underline"
            >
              Ativar participação
            </a>
          </div>
        ) : (
          <>
            <JogosFiltro soAbertos={soAbertosAtivo} soEncerrados={soEncerradosAtivo} />
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
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
