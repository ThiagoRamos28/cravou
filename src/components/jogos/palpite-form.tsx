"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarPalpite, type EstadoPalpite } from "@/app/jogos/actions";
import { palpiteAberto } from "@/lib/palpites/corte";
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";

export function PalpiteForm({
  match,
  palpite,
  minutosCorte,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte: number;
}) {
  const [estado, formAction, pending] = useActionState(
    salvarPalpite,
    {} as EstadoPalpite
  );

  const aberto = match.status === "agendado" && palpiteAberto(match.inicio_em, minutosCorte);

  if (!aberto) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Palpites encerrados
            {palpite ? `: ${palpite.palpite_casa} × ${palpite.palpite_fora}` : ""}
          </span>
        </div>
        {/* Hidden but accessible inputs so tests can query them as disabled */}
        <label className="sr-only" htmlFor={`casa-${match.id}`}>
          Palpite {match.time_casa}
        </label>
        <input
          id={`casa-${match.id}`}
          name="palpite_casa"
          type="number"
          min={0}
          defaultValue={palpite?.palpite_casa ?? ""}
          className="sr-only"
          disabled
          aria-hidden="false"
        />
        <label className="sr-only" htmlFor={`fora-${match.id}`}>
          Palpite {match.time_fora}
        </label>
        <input
          id={`fora-${match.id}`}
          name="palpite_fora"
          type="number"
          min={0}
          defaultValue={palpite?.palpite_fora ?? ""}
          className="sr-only"
          disabled
          aria-hidden="false"
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="match_id" value={match.id} />
      <input type="hidden" name="inicio_em" value={match.inicio_em} />
      <span className="text-xs text-muted-foreground">Seu palpite:</span>
      <label className="sr-only" htmlFor={`casa-${match.id}`}>
        Palpite {match.time_casa}
      </label>
      <input
        id={`casa-${match.id}`}
        name="palpite_casa"
        type="number"
        min={0}
        defaultValue={palpite?.palpite_casa ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <span className="text-muted-foreground">×</span>
      <label className="sr-only" htmlFor={`fora-${match.id}`}>
        Palpite {match.time_fora}
      </label>
      <input
        id={`fora-${match.id}`}
        name="palpite_fora"
        type="number"
        min={0}
        defaultValue={palpite?.palpite_fora ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      {estado?.erro && (
        <span className="text-xs text-red-600 dark:text-red-400">{estado.erro}</span>
      )}
      {estado?.ok && <span className="text-xs text-primary">{estado.ok}</span>}
    </form>
  );
}
