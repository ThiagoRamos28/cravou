"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { atualizarSenha, type EstadoPerfil } from "@/app/perfil/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Salvando..." : "Salvar nova senha"}
    </Button>
  );
}

export function SenhaForm() {
  const [estado, formAction] = useActionState(
    atualizarSenha,
    {} as EstadoPerfil
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
        Senha
      </h2>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha_atual" className="text-sm font-medium">
            Senha atual
          </label>
          <input
            id="senha_atual"
            name="senha_atual"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha_nova" className="text-sm font-medium">
            Nova senha
          </label>
          <input
            id="senha_nova"
            name="senha_nova"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmar" className="text-sm font-medium">
            Confirmar nova senha
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
        {estado?.sucesso && (
          <p
            role="status"
            className="text-sm text-green-600 dark:text-green-400"
          >
            Senha alterada com sucesso!
          </p>
        )}
        <Submit />
      </form>
    </div>
  );
}
