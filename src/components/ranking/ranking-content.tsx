"use client";

import { useRef, useState } from "react";
import { Podium } from "@/components/ranking/podium";
import { RankingTable } from "@/components/ranking/ranking-table";
import { RankingListaMobile } from "@/components/ranking/ranking-lista-mobile";
import { SeasonSelector } from "@/components/ranking/season-selector";
import { MesSelector } from "@/components/ranking/mes-selector";
import { FaixaCampeao } from "@/components/ranking/faixa-campeao";
import { CompeticaoTabs } from "@/components/ranking/competicao-tabs";
import { buscarRanking } from "@/app/ranking/actions";
import { rotuloMes, type MesRanking, type RankingPeriodo, type RankingRow } from "@/lib/ranking-shared";
import type { Competicao } from "@/lib/competicoes-shared";

function PodiumSkeleton() {
  return (
    <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6" aria-hidden="true">
      <div className="h-24 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
      <div className="h-32 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
      <div className="h-20 w-20 animate-pulse rounded-2xl bg-muted sm:w-28" />
    </div>
  );
}

function TableSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
}

export function RankingContent({
  linhasIniciais,
  meuId,
  competicao,
  competicoes,
  meses,
  periodoInicial,
  anoCorrente,
}: {
  linhasIniciais: RankingRow[];
  meuId: string;
  competicao: Competicao;
  competicoes: Competicao[];
  meses: MesRanking[];
  periodoInicial: RankingPeriodo;
  anoCorrente: number;
}) {
  const [periodo, setPeriodo] = useState<RankingPeriodo>(periodoInicial);
  const [linhas, setLinhas] = useState<RankingRow[]>(linhasIniciais);
  const [carregando, setCarregando] = useState(false);
  const periodoAtualRef = useRef<RankingPeriodo>(periodoInicial);

  async function aoTrocarPeriodo(novoPeriodo: RankingPeriodo) {
    setPeriodo(novoPeriodo);
    periodoAtualRef.current = novoPeriodo;
    setCarregando(true);
    try {
      const resultado = await buscarRanking(competicao.id, novoPeriodo);
      if (periodoAtualRef.current === novoPeriodo) {
        setLinhas(resultado);
      }
    } catch {
      // Falha aberta: mantém as linhas anteriores.
    } finally {
      if (periodoAtualRef.current === novoPeriodo) {
        setCarregando(false);
      }
    }
  }

  // Só é mês se o período casar com um mês que a competição realmente tem.
  const mesSelecionado = meses.find((m) => m.mes === periodo);
  const rotulo = mesSelecionado ? rotuloMes(mesSelecionado.mes, anoCorrente) : "";

  return (
    <div>
      <CompeticaoTabs competicoes={competicoes} selecionadaId={competicao.id} />
      {competicao.formato === "fases" ? (
        <SeasonSelector periodo={periodo} onChange={aoTrocarPeriodo} />
      ) : (
        <MesSelector
          meses={meses}
          periodo={periodo}
          onChange={aoTrocarPeriodo}
          anoCorrente={anoCorrente}
        />
      )}
      {carregando ? (
        <>
          <PodiumSkeleton />
          <TableSkeleton />
        </>
      ) : linhas.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          {mesSelecionado
            ? `Ninguém palpitou em ${rotulo} ainda.`
            : "Nenhum palpite pontuado neste período ainda."}
        </p>
      ) : (
        <>
          {mesSelecionado && (
            <FaixaCampeao rotulo={rotulo} fechado={mesSelecionado.fechado} linhas={linhas} />
          )}
          <Podium linhas={linhas} />
          <RankingTable linhas={linhas} meuId={meuId} />
          <RankingListaMobile linhas={linhas} meuId={meuId} />
        </>
      )}
    </div>
  );
}
