"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicarPost } from "@/app/feed/actions";
import { traduzirPais } from "@/lib/i18n/paises";

type CompartilharModalProps = {
  jogoId: string;
  timeCasa: string;
  timeFora: string;
  palpiteCasa: number;
  palpiteFora: number;
  onClose: () => void;
};

export function CompartilharModal({
  jogoId,
  timeCasa,
  timeFora,
  palpiteCasa,
  palpiteFora,
  onClose,
}: CompartilharModalProps) {
  const sugestao = `Cravo ${palpiteCasa} × ${palpiteFora}! 🔥`;
  const [texto, setTexto] = useState(sugestao);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const restantes = 140 - texto.length;

  function handlePostar() {
    setErro(null);
    startTransition(async () => {
      const result = await publicarPost(texto, jogoId);
      if (result.erro) {
        setErro(result.erro);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            Provocar a galera?
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 rounded-xl border border-border bg-muted px-4 py-3 text-center">
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              <span>{traduzirPais(timeCasa)}</span>
              <span>{traduzirPais(timeFora)}</span>
            </div>
            <div className="text-lg font-bold tabular-nums">
              {palpiteCasa} × {palpiteFora}
            </div>
          </div>

          <div className="relative mb-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={145}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="mb-3 flex justify-end">
            <span
              className={`text-xs font-medium tabular-nums ${
                restantes <= 20 ? "text-red-500" : "text-muted-foreground"
              }`}
            >
              {restantes}
            </span>
          </div>

          {erro && (
            <p role="alert" className="mb-3 text-xs text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1"
            >
              Pular
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePostar}
              disabled={isPending || texto.trim().length === 0 || restantes < 0}
              className="flex-1"
            >
              {isPending ? "Postando..." : "Postar no feed"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
