"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { salvarConfiguracoes } from "@/app/admin/config/actions";
import type { ConfigRow } from "@/lib/config";

const CAMPOS: { chave: string; label: string; hint: string; min: number }[] = [
  { chave: "minutos_corte", label: "Corte (min antes do jogo)", hint: "Palpites encerram X min antes do início", min: 1 },
  { chave: "pts_placar_exato", label: "Placar exato (pts)", hint: "Casa e fora corretos", min: 0 },
  { chave: "pts_saldo", label: "Saldo + vencedor (pts)", hint: "Vitória com diferença de gols exata", min: 0 },
  { chave: "pts_resultado", label: "Resultado V/E/D (pts)", hint: "Acertou quem ganhou ou empatou", min: 0 },
  { chave: "pts_gols_time", label: "Gols de um time (pts)", hint: "Acertou só os gols de um lado", min: 0 },
];

export function ConfigForm({ config }: { config: ConfigRow[] }) {
  const mapaValores = Object.fromEntries(config.map((r) => [r.chave, r.valor]));
  const [estado, formAction, pending] = useActionState(salvarConfiguracoes, null);
  const { toast } = useToast();

  useEffect(() => {
    if (estado?.ok) toast({ message: estado.ok, variant: "success" });
  }, [estado?.ok, toast]);

  useEffect(() => {
    if (estado?.erro) toast({ message: estado.erro, variant: "error" });
  }, [estado?.erro, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {CAMPOS.map(({ chave, label, hint, min }) => (
        <div key={chave} className="flex flex-col gap-1">
          <label htmlFor={chave} className="text-sm font-medium text-foreground">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <input
            id={chave}
            name={chave}
            type="number"
            min={min}
            step={1}
            defaultValue={mapaValores[chave] ?? 0}
            className="h-10 w-32 rounded-lg border border-border bg-background px-3 text-sm"
          />
        </div>
      ))}

      {estado?.erro && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {estado.erro}
        </p>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
