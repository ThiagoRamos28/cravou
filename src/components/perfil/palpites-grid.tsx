import { PalpiteCardCompacto } from "./palpite-card-compacto";
import type { PalpiteResumido } from "@/lib/feed";

type PalpitesGridProps = { palpites: PalpiteResumido[] };

export function PalpitesGrid({ palpites }: PalpitesGridProps) {
  if (palpites.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum palpite registrado ainda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {palpites.slice(0, 10).map((p) => (
        <PalpiteCardCompacto key={p.jogo_id} palpite={p} />
      ))}
    </div>
  );
}
