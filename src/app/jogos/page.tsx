import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { JogosLista } from "@/components/jogos/jogos-lista";
import { NovidadesModal } from "@/components/novidades-modal";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, listarFormaCompeticao } from "@/lib/matches";
import type { Situacao } from "@/lib/jogos/filtros";
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
  searchParams: Promise<{
    situacao?: string;
    // soAbertos/encerrados: parâmetros da tela antiga (pré-listagens-jogos). Sem
    // `situacao` na URL, um link ou favorito salvo com eles ainda deve funcionar.
    soAbertos?: string;
    encerrados?: string;
    de?: string;
    ate?: string;
    ordem?: string;
  }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const sp = await searchParams;
  const situacaoLegado: Situacao | null =
    sp.encerrados === "1" ? "encerrados" : sp.soAbertos === "0" ? "todos" : null;
  // Padrão: jogos que ainda não terminaram, a menos que se peça outra coisa.
  const situacao: Situacao =
    sp.situacao === "encerrados" || sp.situacao === "todos"
      ? sp.situacao
      : (situacaoLegado ?? "a_fazer");
  const ordem: "asc" | "desc" = sp.ordem === "desc" ? "desc" : "asc";
  const { de, ate } = sp;

  const [todas, optIns, cookieStore] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);
  const participando = atual ? optIns.includes(atual.slug) : false;

  const filtro = atual
    ? { competicaoId: atual.id, situacao, de, ate, ordem }
    : null;

  const minutosCorte = await getMinutosCorte();
  const [{ jogos }, palpites] = await Promise.all([
    filtro ? listarJogos(filtro) : Promise.resolve({ jogos: [], total: 0 }),
    listarMeusPalpites(),
  ]);

  const formaPorTime = atual
    ? await listarFormaCompeticao(atual.id)
    : new Map();


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
            <JogosFiltro situacao={situacao} ordem={ordem} de={de} ate={ate} />
            {/* O `key` é obrigatório: sem ele o useState interno da lista ignora a nova
                primeira página e a tela mantém os jogos do filtro anterior (59c2f38). */}
            <JogosLista
              key={`${filtro!.competicaoId}|${situacao}|${de ?? ""}|${ate ?? ""}|${ordem}`}
              jogosIniciais={jogos}
              palpites={palpites}
              minutosCorte={minutosCorte}
              formaPorTime={formaPorTime}
              filtro={filtro!}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
