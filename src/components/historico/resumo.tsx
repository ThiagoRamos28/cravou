import { Trophy, Target, Percent } from "lucide-react";

function Card({ icon, valor, rotulo }: { icon: React.ReactNode; valor: string; rotulo: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center">
      <span className="text-accent" aria-hidden="true">{icon}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  );
}

export function Resumo({
  totalPontos,
  cravadas,
  aproveitamento,
}: {
  totalPontos: number;
  cravadas: number;
  aproveitamento: number;
}) {
  return (
    <div className="mb-8 grid grid-cols-3 gap-3">
      <Card icon={<Trophy className="h-5 w-5" />} valor={String(totalPontos)} rotulo="Pontos" />
      <Card icon={<Target className="h-5 w-5" />} valor={String(cravadas)} rotulo="Cravadas" />
      <Card icon={<Percent className="h-5 w-5" />} valor={`${Math.round(aproveitamento * 100)}%`} rotulo="Aproveitamento" />
    </div>
  );
}
