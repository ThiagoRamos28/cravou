"use client";

import { useState, useTransition } from "react";
import { MatchCard } from "@/components/jogos/match-card";
import { Button } from "@/components/ui/button";
import { carregarMaisJogos } from "@/app/jogos/actions";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { Match, FormaJogo } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";
import type { Situacao } from "@/lib/jogos/filtros";

// A página passa `key` com a assinatura do filtro. Sem isso, `useState(jogosIniciais)`
// ignoraria o novo valor inicial quando o servidor re-renderiza com outro filtro, e a tela
// ficaria mostrando os jogos do filtro anterior — o bug do /ranking que exigia F5 (59c2f38).
export function JogosLista({
  jogosIniciais,
  palpites,
  minutosCorte,
  formaPorTime,
  filtro,
}: {
  jogosIniciais: Match[];
  palpites: Record<string, Prediction>;
  minutosCorte: number;
  formaPorTime: Map<string, FormaJogo[]>;
  filtro: {
    competicaoId: string;
    situacao: Situacao;
    de?: string;
    ate?: string;
    ordem: "asc" | "desc";
  };
}) {
  const [jogos, setJogos] = useState(jogosIniciais);
  const [offset, setOffset] = useState(jogosIniciais.length);
  const [temMais, setTemMais] = useState(jogosIniciais.length === JOGOS_POR_PAGINA);
  const [carregando, startTransition] = useTransition();

  function aoCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisJogos({ ...filtro, offset });
      setJogos((antes) => [...antes, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < JOGOS_POR_PAGINA) setTemMais(false);
    });
  }

  if (jogos.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Nenhum jogo encontrado com esses filtros.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {jogos.map((j) => (
          <MatchCard
            key={j.id}
            match={j}
            palpite={palpites[j.id]}
            minutosCorte={minutosCorte}
            formaCasa={formaPorTime.get(j.time_casa) ?? []}
            formaFora={formaPorTime.get(j.time_fora) ?? []}
          />
        ))}
      </div>
      {temMais && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={aoCarregarMais}
            disabled={carregando}
          >
            {carregando ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </>
  );
}
