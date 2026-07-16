"use client";

import { useRef, useState } from "react";
import { Podium } from "@/components/ranking/podium";
import { RankingTable } from "@/components/ranking/ranking-table";
import { RankingListaMobile } from "@/components/ranking/ranking-lista-mobile";
import { SeasonSelector } from "@/components/ranking/season-selector";
import { buscarRanking } from "@/app/ranking/actions";
import type { RankingPeriodo, RankingRow } from "@/lib/ranking";
import type { Competicao } from "@/lib/competicoes";

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
  return (
    <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
  );
}

export function RankingContent({
  linhasIniciais,
  meuId,
  competicao,
}: {
  linhasIniciais: RankingRow[];
  meuId: string;
  competicao: Competicao;
}) {
  const [periodo, setPeriodo] = useState<RankingPeriodo>("geral");
  const [linhas, setLinhas] = useState<RankingRow[]>(linhasIniciais);
  const [carregando, setCarregando] = useState(false);
  const periodoAtualRef = useRef<RankingPeriodo>("geral");

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

  return (
    <div>
      {competicao.formato === "fases" && (
        <SeasonSelector periodo={periodo} onChange={aoTrocarPeriodo} />
      )}
      {carregando ? (
        <>
          <PodiumSkeleton />
          <TableSkeleton />
        </>
      ) : linhas.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          Nenhum palpite pontuado neste período ainda.
        </p>
      ) : (
        <>
          <Podium linhas={linhas} />
          <RankingTable linhas={linhas} meuId={meuId} />
          <RankingListaMobile linhas={linhas} meuId={meuId} />
        </>
      )}
    </div>
  );
}
