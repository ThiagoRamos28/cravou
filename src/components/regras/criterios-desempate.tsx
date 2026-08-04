import { CRITERIOS_DESEMPATE } from "@/lib/ranking-shared";

export function CriteriosDesempate() {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
      <p className="mb-2 font-semibold text-foreground">Critérios de desempate</p>
      <p className="mb-3">
        Quando dois palpiteiros terminam com a mesma pontuação, o ranking desce por
        estes critérios, na ordem:
      </p>
      <ol className="ml-5 list-decimal space-y-1">
        {CRITERIOS_DESEMPATE.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <p className="mt-3">
        Quem empatar nos seis divide o título de campeão do mês; na tabela, a ordem entre
        eles é alfabética.
      </p>
    </div>
  );
}
