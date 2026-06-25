import { Target } from "lucide-react";
import type { RankingRow } from "@/lib/ranking";
import { avatarPadrao } from "@/lib/avatars";

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
            <th className="px-3 py-3 text-center font-semibold" title="Placares cravados">
              <Target className="mx-auto h-4 w-4" aria-label="Cravadas" />
            </th>
            <th className="px-3 py-3 text-right font-semibold">Pontos</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const eu = l.user_id === meuId;
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
                <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">
                  {l.cravadas}
                </td>
                <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums">
                  {l.pontos}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
