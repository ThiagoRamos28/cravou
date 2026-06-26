"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { redefinirSenha, type EstadoRedefinir } from "./actions";

export function RedefinirSenhaForm() {
  const [estado, formAction] = useActionState(redefinirSenha, {} as EstadoRedefinir);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
      <h1 className="mb-6 font-display text-xl font-bold uppercase tracking-tight">
        Nova senha
      </h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-sm font-medium">
            Nova senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmar" className="text-sm font-medium">
            Confirmar senha
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {estado?.erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        <Button type="submit" variant="cta" className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
