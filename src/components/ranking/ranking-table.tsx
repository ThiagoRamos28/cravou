import type { RankingRow } from "@/lib/ranking";
import { avatarPadrao } from "@/lib/avatars";
import { COLUNAS_ICONE } from "@/components/ranking/colunas";

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
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
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
                className={`border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50 ${
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
