import { Target, ArrowLeftRight, Trophy, CircleDot, XCircle, Equal } from "lucide-react";
import type { RankingRow } from "@/lib/ranking";

export type ColIcone = {
  icon: React.ReactNode;
  label: string;
  pts: number;
  valor: (l: RankingRow) => number;
};

export const COLUNAS_ICONE: ColIcone[] = [
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
