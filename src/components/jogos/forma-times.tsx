"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { traduzirPais } from "@/lib/i18n/paises";
import type { FormaJogo, ResultadoForma } from "@/lib/matches";

const COR: Record<ResultadoForma, string> = {
  V: "bg-green-600 text-white",
  E: "bg-amber-500 text-black",
  D: "bg-red-600 text-white",
};

const ROTULO: Record<ResultadoForma, string> = { V: "Vitória", E: "Empate", D: "Derrota" };

function Badge({ jogo }: { jogo: FormaJogo }) {
  const placar =
    jogo.mando === "casa"
      ? `${jogo.golsPro}×${jogo.golsContra}`
      : `${jogo.golsContra}×${jogo.golsPro}`;
  const rotulo = `${ROTULO[jogo.resultado]} — ${jogo.mando === "casa" ? "" : "fora, "}${placar} vs ${traduzirPais(jogo.adversario)}`;
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${COR[jogo.resultado]}`}
      title={rotulo}
      aria-label={rotulo}
    >
      {jogo.resultado}
    </span>
  );
}

function LinhaBadges({ nome, forma }: { nome: string; forma: FormaJogo[] }) {
  if (forma.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-xs font-medium">{nome}</span>
      <span className="flex shrink-0 gap-1">
        {forma.map((j, i) => (
          <Badge key={i} jogo={j} />
        ))}
      </span>
    </div>
  );
}

function DetalheTime({ nome, forma }: { nome: string; forma: FormaJogo[] }) {
  if (forma.length === 0) return null;
  return (
    <div className="text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">{nome}:</span>{" "}
      {forma
        .slice()
        .reverse()
        .map((j) => {
          const placar =
            j.mando === "casa"
              ? `${j.golsPro}×${j.golsContra}`
              : `${j.golsContra}×${j.golsPro}`;
          return `${placar} ${traduzirPais(j.adversario)} (${j.resultado})`;
        })
        .join(" · ")}
    </div>
  );
}

export function FormaTimes({
  nomeCasa,
  nomeFora,
  formaCasa,
  formaFora,
}: {
  nomeCasa: string;
  nomeFora: string;
  formaCasa: FormaJogo[];
  formaFora: FormaJogo[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex flex-col gap-1">
        <LinhaBadges nome={nomeCasa} forma={formaCasa} />
        <LinhaBadges nome={nomeFora} forma={formaFora} />
      </div>

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        ver forma
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-1">
          <DetalheTime nome={nomeCasa} forma={formaCasa} />
          <DetalheTime nome={nomeFora} forma={formaFora} />
        </div>
      )}
    </div>
  );
}
