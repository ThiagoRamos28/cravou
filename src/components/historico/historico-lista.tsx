"use client";

import { useState, useTransition } from "react";
import { HistoricoItem } from "@/components/historico/historico-item";
import { Button } from "@/components/ui/button";
import { carregarMaisHistorico } from "@/app/historico/actions";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";
import type { ItemHistorico } from "@/lib/historico";

// A página passa `key` com a assinatura do filtro — sem isso o useState abaixo ignoraria a
// nova primeira página e a tela manteria os itens do filtro anterior (59c2f38).
export function HistoricoLista({
  itensIniciais,
  filtro,
}: {
  itensIniciais: ItemHistorico[];
  filtro: { competicaoId: string; de?: string; ate?: string; ordem: "asc" | "desc" };
}) {
  const [itens, setItens] = useState(itensIniciais);
  const [offset, setOffset] = useState(itensIniciais.length);
  const [temMais, setTemMais] = useState(itensIniciais.length === JOGOS_POR_PAGINA);
  const [carregando, startTransition] = useTransition();

  function aoCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisHistorico({ ...filtro, offset });
      setItens((antes) => [...antes, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < JOGOS_POR_PAGINA) setTemMais(false);
    });
  }

  if (itens.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Nenhum jogo encerrado com palpite seu nesse período.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {itens.map((item) => (
          <HistoricoItem key={item.match.id} item={item} />
        ))}
      </div>
      {temMais && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="sm" onClick={aoCarregarMais} disabled={carregando}>
            {carregando ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </>
  );
}
