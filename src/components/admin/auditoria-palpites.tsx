import { Trophy, Target, CheckCircle, Circle, X } from "lucide-react";
import type { PalpiteAuditado, MotivoNivel } from "@/lib/auditoria/palpites";

type IconeComponent = React.ComponentType<{
  className?: string;
  title?: string;
  "aria-label"?: string;
}>;

const ICONES: Record<MotivoNivel, IconeComponent> = {
  exato: Trophy,
  saldo: Target,
  resultado: CheckCircle,
  gols: Circle,
  erro: X,
};

const LABELS: Record<MotivoNivel, string> = {
  exato: "Placar exato",
  saldo: "Saldo certo",
  resultado: "Resultado certo",
  gols: "Acertou gols",
  erro: "Errou",
};

export function AuditoriaPalpites({
  palpites,
}: {
  palpites: PalpiteAuditado[];
}) {
  if (palpites.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Selecione um jogo finalizado para ver os palpites.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3 text-left font-semibold">Apelido</th>
            <th className="px-3 py-3 text-center font-semibold">Palpite</th>
            <th className="px-3 py-3 text-center font-semibold">Pontos</th>
            <th className="px-3 py-3 text-left font-semibold">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {palpites.map((p) => {
            const Icone = ICONES[p.motivo];
            const temPontos = (p.pontos ?? 0) > 0;
            return (
              <tr
                key={p.id}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-3 py-3 font-medium">{p.apelido}</td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {p.palpite_casa} × {p.palpite_fora}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-block min-w-8 rounded-md px-2 py-0.5 text-xs font-bold ${
                      temPontos
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.pontos ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-1.5">
                    <Icone
                      className="h-4 w-4 shrink-0"
                      title={p.detalhe}
                      aria-label={p.detalhe}
                    />
                    <span className="text-muted-foreground">
                      {LABELS[p.motivo]}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
