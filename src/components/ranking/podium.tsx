import { Crown } from "lucide-react";
import type { RankingRow } from "@/lib/ranking";
import { Reveal } from "@/components/motion/reveal";
import { avatarPadrao } from "@/lib/avatars";

// Ordem visual do pódio: 2º à esquerda, 1º ao centro (maior), 3º à direita.
const LAYOUT = [
  { idx: 1, ordem: "order-1", altura: "h-24", medalha: "bg-muted text-foreground", delay: 0.1 },
  { idx: 0, ordem: "order-2", altura: "h-32", medalha: "bg-accent text-accent-foreground", delay: 0 },
  { idx: 2, ordem: "order-3", altura: "h-20", medalha: "bg-primary/20 text-foreground", delay: 0.2 },
] as const;

export function Podium({ linhas }: { linhas: RankingRow[] }) {
  const top3 = linhas.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
      {LAYOUT.map(({ idx, ordem, altura, medalha, delay }) => {
        const l = top3[idx];
        if (!l) return null;
        const pos = idx + 1;
        return (
          <Reveal key={l.user_id} from="up" delay={delay} className={`${ordem} flex w-20 flex-col items-center sm:w-28`}>
            <div className="relative">
              {pos === 1 && (
                <Crown
                  className="absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 text-accent"
                  aria-hidden="true"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.avatar_url ?? avatarPadrao(l.user_id)}
                alt=""
                width={56}
                height={56}
                className="h-10 w-10 rounded-full bg-muted object-cover ring-2 ring-border sm:h-14 sm:w-14"
              />
            </div>
            <span className="mt-2 max-w-full truncate text-center text-xs font-semibold sm:text-sm">
              {l.apelido ?? "Sem apelido"}
            </span>
            <span className="font-display text-lg font-bold tabular-nums">
              {l.pontos}
              <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
            </span>
            <div
              className={`mt-2 flex w-full items-start justify-center rounded-t-xl ${altura} ${medalha} pt-2 font-display text-xl font-bold`}
            >
              {pos}º
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
