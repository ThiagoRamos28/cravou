"use client";

import { useState, useTransition } from "react";
import { PalpiteAmigoCard } from "./palpite-amigo-card";
import { carregarMaisPalpites } from "@/app/feed/actions";
import type { PalpiteAmigo } from "@/lib/feed";
import { PALPITE_LIMIT } from "@/lib/feed-constants";
import { Button } from "@/components/ui/button";

type PalpitesAmigosListProps = {
  palpitesIniciais: PalpiteAmigo[];
  userId: string;
};

export function PalpitesAmigosList({ palpitesIniciais, userId }: PalpitesAmigosListProps) {
  const [palpites, setPalpites] = useState(palpitesIniciais);
  const [offset, setOffset] = useState(palpitesIniciais.length);
  const [temMais, setTemMais] = useState(palpitesIniciais.length === PALPITE_LIMIT);
  const [isPending, startTransition] = useTransition();

  function handleCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisPalpites(offset, userId);
      setPalpites((prev) => [...prev, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < PALPITE_LIMIT) setTemMais(false);
    });
  }

  if (palpites.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Siga pessoas para ver os palpites delas aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {palpites.map((p, i) => (
        <PalpiteAmigoCard key={`${p.autor.id}-${p.jogo_id}-${i}`} palpite={p} />
      ))}
      {temMais && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCarregarMais}
            disabled={isPending}
          >
            {isPending ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
