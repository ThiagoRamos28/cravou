"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

export function ScoreStepper({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: number;
}) {
  const [valor, setValor] = useState<string>(
    defaultValue !== undefined ? String(defaultValue) : ""
  );

  const numero = valor === "" ? 0 : parseInt(valor, 10);

  function ajustar(delta: number) {
    setValor(String(Math.max(0, numero + delta)));
  }

  const botao =
    "flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => ajustar(-1)}
        disabled={numero <= 0}
        aria-label={`Diminuir ${label}`}
        className={botao}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
        className="h-11 w-12 rounded-lg border border-border bg-background text-center tabular-nums"
      />
      <button
        type="button"
        onClick={() => ajustar(1)}
        aria-label={`Aumentar ${label}`}
        className={botao}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
