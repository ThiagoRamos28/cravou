import { Target, ArrowLeftRight, Trophy, CircleDot, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const NIVEIS = [
  {
    icon: <Target className="h-6 w-6 text-accent" />,
    pts: 10,
    titulo: "Cravou!",
    descricao:
      "Você acertou o placar exato — tanto os gols do time da casa quanto os do visitante. É a pontuação máxima.",
    exemplo: "Palpite 2×1 · Resultado 2×1",
  },
  {
    icon: <ArrowLeftRight className="h-6 w-6 text-primary" />,
    pts: 7,
    titulo: "Saldo certo",
    descricao:
      "Você acertou o vencedor e a diferença de gols, mas o placar não foi exato. Vale apenas em vitórias — em empates não existe saldo diferente do exato.",
    exemplo: "Palpite 3×1 · Resultado 2×0  (diferença de 2 em ambos)",
  },
  {
    icon: <Trophy className="h-6 w-6 text-yellow-500" />,
    pts: 5,
    titulo: "Vencedor",
    descricao:
      "Você acertou quem ganhou (ou que seria empate), mas errou o saldo de gols.",
    exemplo: "Palpite 1×0 · Resultado 3×1  (ambos vitória da casa)",
  },
  {
    icon: <CircleDot className="h-6 w-6 text-muted-foreground" />,
    pts: 2,
    titulo: "Gols parciais",
    descricao:
      "Você errou o resultado, mas acertou exatamente os gols de um dos times.",
    exemplo: "Palpite 2×1 · Resultado 2×3  (casa acertou, mas perdeu)",
  },
  {
    icon: <XCircle className="h-6 w-6 text-red-500" />,
    pts: 0,
    titulo: "Erro",
    descricao: "Nenhum dos critérios acima foi atendido.",
    exemplo: "Palpite 1×0 · Resultado 0×2",
  },
];

export default function RegrasPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight">
          Regras de pontuação
        </h1>
        <p className="mb-10 text-muted-foreground">
          Cada palpite recebe os pontos da categoria mais alta que ele acertar.
          Os níveis são avaliados de cima para baixo — o primeiro que casar é o
          que vale.
        </p>

        <ol className="flex flex-col gap-4">
          {NIVEIS.map((n, i) => (
            <li
              key={n.pts}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="mt-0.5 shrink-0">{n.icon}</div>
              <div className="flex-1">
                <div className="mb-1 flex items-baseline gap-3">
                  <span className="font-display text-lg font-bold uppercase tracking-tight">
                    {n.titulo}
                  </span>
                  <span className="font-display text-sm font-bold text-primary">
                    {n.pts > 0 ? `+${n.pts} pts` : "0 pts"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    nível {i + 1}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{n.descricao}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ex.: {n.exemplo}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Corte de palpites</p>
          <p>
            Você pode alterar seu palpite até <strong>10 minutos antes</strong>{" "}
            do início do jogo. Após esse prazo, o palpite fica bloqueado.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Jogos com prorrogação</p>
          <p>
            Na fase de mata-mata, a pontuação considera apenas o placar dos{" "}
            <strong>90 minutos</strong> (tempo normal). Gols marcados na
            prorrogação não contam para o palpite.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
