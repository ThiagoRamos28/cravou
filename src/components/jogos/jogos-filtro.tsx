"use client";

import { useRouter, usePathname } from "next/navigation";

const FASE_LABEL: Record<string, string> = {
  grupos: "Grupos",
  oitavas: "Oitavas",
  quartas: "Quartas",
  semi: "Semi",
  final: "Final",
};

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

export function JogosFiltro({
  fases,
  faseAtiva,
  rodadaAtiva,
  soAbertos,
}: {
  fases: { fase: string; rodadas: string[] }[];
  faseAtiva: string;
  rodadaAtiva: string;
  soAbertos: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function ir(fase: string, rodada: string) {
    const params = new URLSearchParams();
    if (fase) params.set("fase", fase);
    if (rodada) params.set("rodada", rodada);
    if (soAbertos) params.set("soAbertos", "1");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleAbertos() {
    const params = new URLSearchParams();
    if (faseAtiva) params.set("fase", faseAtiva);
    if (rodadaAtiva) params.set("rodada", rodadaAtiva);
    if (!soAbertos) params.set("soAbertos", "1");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const rodadas = fases.find((f) => f.fase === faseAtiva)?.rodadas ?? [];

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro rápido">
        <button
          type="button"
          onClick={toggleAbertos}
          aria-current={soAbertos ? "true" : undefined}
          className={chip(soAbertos)}
        >
          Palpitar agora
        </button>
      </div>
      {fases.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fase">
          {fases.map((f) => (
            <button
              key={f.fase}
              type="button"
              onClick={() => ir(f.fase, "")}
              aria-current={f.fase === faseAtiva ? "true" : undefined}
              className={chip(f.fase === faseAtiva)}
            >
              {FASE_LABEL[f.fase] ?? f.fase}
            </button>
          ))}
        </div>
      )}
      {rodadas.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rodada">
          {rodadas.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => ir(faseAtiva, r)}
              aria-current={r === rodadaAtiva ? "true" : undefined}
              className={chip(r === rodadaAtiva)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
