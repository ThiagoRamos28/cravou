import { Target, ArrowLeftRight, Trophy, CircleDot, XCircle, Equal } from "lucide-react";
import type { RankingRow } from "@/lib/ranking";
import { avatarPadrao } from "@/lib/avatars";

type ColIcone = {
  icon: React.ReactNode;
  label: string;
  pts: number;
  valor: (l: RankingRow) => number;
};

const COLUNAS_ICONE: ColIcone[] = [
  {
    icon: <Target className="mx-auto h-4 w-4 text-accent" />,
    label: "Cravou! — placar exato (10 pts)",
    pts: 10,
    valor: (l) => l.cravadas,
  },
  {
    icon: <ArrowLeftRight className="mx-auto h-4 w-4 text-primary" />,
    label: "Saldo certo — vencedor + diferença de gols (7 pts)",
    pts: 7,
    valor: (l) => l.acertos_saldo,
  },
  {
    icon: <Trophy className="mx-auto h-4 w-4 text-yellow-500" />,
    label: "Vencedor — acertou o resultado V/E/D (5 pts)",
    pts: 5,
    valor: (l) => l.acertos_resultado,
  },
  {
    icon: <CircleDot className="mx-auto h-4 w-4 text-muted-foreground" />,
    label: "Gols parciais — acertou os gols de um time (2 pts)",
    pts: 2,
    valor: (l) => l.acertos_gols,
  },
  {
    icon: <XCircle className="mx-auto h-4 w-4 text-red-500" />,
    label: "Erros — palpites já pontuados com 0 pts",
    pts: -1,
    valor: (l) => l.erros,
  },
  {
    icon: <Equal className="mx-auto h-4 w-4 text-cyan-500" />,
    label: "Total de palpites encerrados (já pontuados)",
    pts: -2,
    valor: (l) => l.palpites_pontuados,
  },
];

export function RankingTable({
  linhas,
  meuId,
}: {
  linhas: RankingRow[];
  meuId: string | null;
}) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
        Ainda não há pontuações. Os pontos aparecem aqui assim que os primeiros
        jogos forem encerrados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3 text-center font-semibold">#</th>
            <th className="px-3 py-3 text-left font-semibold">Jogador</th>
            {COLUNAS_ICONE.map((col) => (
              <th
                key={col.pts}
                className="px-2 py-3 text-center font-semibold"
                title={col.label}
              >
                {col.icon}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold">Pontos</th>
            <th
              className="px-3 py-3 text-right font-semibold"
              title="Aproveitamento (pontos / máximo possível)"
            >
              Aprov.
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const eu = l.user_id === meuId;
            const maxPontos = l.palpites_pontuados * 10;
            const aproveitamento =
              maxPontos > 0
                ? `${Math.round((l.pontos / maxPontos) * 100)}%`
                : "—";
            return (
              <tr
                key={l.user_id}
                data-eu={eu}
                className={`border-b border-border/60 last:border-0 ${
                  eu ? "bg-primary/10 font-semibold" : ""
                }`}
              >
                <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.avatar_url ?? avatarPadrao(l.user_id)}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full bg-muted object-cover"
                    />
                    <span>
                      {l.apelido ?? "Sem apelido"}
                      {eu && (
                        <span className="ml-2 text-xs font-normal text-primary">
                          você
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                {COLUNAS_ICONE.map((col) => (
                  <td
                    key={col.pts}
                    className="px-2 py-3 text-center tabular-nums text-muted-foreground"
                  >
                    {col.valor(l) > 0 ? col.valor(l) : "—"}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums">
                  {l.pontos}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {aproveitamento}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
