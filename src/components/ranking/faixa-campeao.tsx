import { Trophy } from "lucide-react";
import { campeaoDoMes, type RankingRow } from "@/lib/ranking-shared";

function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function FaixaCampeao({
  rotulo,
  fechado,
  linhas,
}: {
  rotulo: string;
  fechado: boolean;
  linhas: RankingRow[];
}) {
  const campeao = campeaoDoMes(linhas);

  // Mês encerrado sem ninguém pontuando não ganha faixa anunciando isso.
  if (fechado && !campeao) return null;

  let titulo: string;
  let detalhe: string;

  if (fechado && campeao) {
    titulo = campeao.nomes.length > 1 ? `Campeões de ${rotulo}` : `Campeão de ${rotulo}`;
    detalhe = `${juntarNomes(campeao.nomes)} · ${campeao.pontos} pts`;
  } else {
    titulo = `${rotulo} em disputa`;
    detalhe = campeao
      ? `liderança de ${juntarNomes(campeao.nomes)} · ${campeao.pontos} pts`
      : "ninguém pontuou ainda";
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <Trophy
        className={`h-6 w-6 shrink-0 ${fechado ? "text-accent" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-display text-base font-bold uppercase tracking-tight">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}
