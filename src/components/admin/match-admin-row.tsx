"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { salvarPlacar } from "@/app/admin/actions";
import type { Match } from "@/lib/matches";

export function MatchAdminRow({ match }: { match: Match }) {
  const [estado, formAction] = useActionState(salvarPlacar, {} as { erro?: string; ok?: string });

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
    >
      <input type="hidden" name="id" value={match.id} />
      <span className="min-w-40 flex-1 font-medium">
        {match.time_casa} <span className="text-muted-foreground">x</span> {match.time_fora}
      </span>
      <label className="sr-only" htmlFor={`casa-${match.id}`}>
        Placar {match.time_casa}
      </label>
      <input
        id={`casa-${match.id}`}
        name="placar_casa"
        type="number"
        min={0}
        defaultValue={match.placar_casa ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <label className="sr-only" htmlFor={`fora-${match.id}`}>
        Placar {match.time_fora}
      </label>
      <input
        id={`fora-${match.id}`}
        name="placar_fora"
        type="number"
        min={0}
        defaultValue={match.placar_fora ?? ""}
        className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
      />
      <Button type="submit" variant="outline" size="sm">
        Salvar
      </Button>
      {estado?.erro && <span className="text-red-600 dark:text-red-400">{estado.erro}</span>}
      {estado?.ok && <span className="text-primary">{estado.ok}</span>}
    </form>
  );
}
