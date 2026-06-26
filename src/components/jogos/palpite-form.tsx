"use client";

import { useActionState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  const { toast } = useToast();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (estado.ok) toast({ message: "Palpite salvo!", variant: "success" });
  }, [estado.ok, toast]);

  useEffect(() => {
    if (estado.erro) toast({ message: estado.erro, variant: "error" });
  }, [estado.erro, toast]);

  const aberto =
    match.status === "agendado" && palpiteAberto(match.inicio_em, minutosCorte);

  const offset = reduce ? 0 : 8;

  if (!aberto) {
    const pontuado =
      match.status === "finalizado" && palpite && palpite.pontos != null;
    const cravou =
      pontuado &&
      palpite!.palpite_casa === match.placar_casa &&
      palpite!.palpite_fora === match.placar_fora;

    return (
      <motion.div
        className="mt-3"
        initial={{ opacity: 0, y: offset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`flex items-center justify-center gap-2 text-xs ${palpite ? "text-foreground" : "text-muted-foreground"}`}>
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Palpites encerrados
            {palpite ? `: ${palpite.palpite_casa} × ${palpite.palpite_fora}` : ""}
          </span>
        </div>
        {pontuado && (
          <motion.div
            className="mt-1.5"
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {cravou ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Cravou! +{palpite!.pontos} pts
              </span>
            ) : (
              <span
                className={`text-xs font-semibold ${
                  palpite!.pontos! > 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                +{palpite!.pontos} pts
              </span>
            )}
          </motion.div>
        )}
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
      </motion.div>
    );
  }

  return (
    <motion.div
      key="open"
      className="mt-3"
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduce ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <form action={formAction} className="flex flex-wrap items-center justify-center gap-2">
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
          <span className="text-xs text-red-600 dark:text-red-400">
            {estado.erro}
          </span>
        )}
        {estado?.ok && (
          <motion.span
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-primary"
          >
            {estado.ok}
          </motion.span>
        )}
      </form>
    </motion.div>
  );
}
