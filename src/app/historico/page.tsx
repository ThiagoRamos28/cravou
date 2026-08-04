import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Resumo } from "@/components/historico/resumo";
import { HistoricoLista } from "@/components/historico/historico-lista";
import { FiltroPeriodo } from "@/components/jogos/filtro-periodo";
import { getSessao } from "@/lib/auth/profile";
import { listarHistorico, linhasParaResumo } from "@/lib/historico-dados";
import { resumoHistorico } from "@/lib/historico";
import {
  listarCompeticoes,
  meusOptIns,
  competicoesVisiveis,
  resolverCompeticao,
  COOKIE_COMPETICAO,
} from "@/lib/competicoes";

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
          Meu histórico
        </h1>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; ordem?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [todas, optIns, cookieStore, sp] = await Promise.all([
    listarCompeticoes(),
    meusOptIns(),
    cookies(),
    searchParams,
  ]);
  const visiveis = competicoesVisiveis(todas, optIns);
  const atual = resolverCompeticao(visiveis, cookieStore.get(COOKIE_COMPETICAO)?.value);

  if (!atual) {
    return (
      <Casca>
        <p className="text-muted-foreground">Nenhuma competição disponível.</p>
      </Casca>
    );
  }

  // Aqui o padrão é o mais recente primeiro — o oposto do /jogos, onde interessa o próximo.
  const ordem: "asc" | "desc" = sp.ordem === "asc" ? "asc" : "desc";
  const { de, ate } = sp;
  const filtro = { competicaoId: atual.id, de, ate, ordem };

  // O resumo vem do conjunto filtrado INTEIRO; a lista, só da primeira página. Derivar o
  // resumo de `itens` mostraria "seus pontos" como os pontos daquela página.
  const [{ itens }, linhas] = await Promise.all([
    listarHistorico({ ...filtro, userId: sessao.userId }),
    linhasParaResumo({ competicaoId: atual.id, userId: sessao.userId, de, ate }),
  ]);
  const resumo = resumoHistorico(linhas);

  return (
    <Casca>
      <div className="mb-6">
        <FiltroPeriodo ordem={ordem} de={de} ate={ate} />
      </div>
      {linhas.length > 0 && <Resumo {...resumo} />}
      <HistoricoLista
        key={`${atual.id}|${de ?? ""}|${ate ?? ""}|${ordem}`}
        itensIniciais={itens}
        filtro={filtro}
      />
    </Casca>
  );
}
