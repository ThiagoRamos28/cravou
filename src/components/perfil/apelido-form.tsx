"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { atualizarApelido, type EstadoPerfil } from "@/app/perfil/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Salvando..." : "Salvar apelido"}
    </Button>
  );
}

export function ApelidoForm({ apelidoAtual }: { apelidoAtual: string }) {
  const [estado, formAction] = useActionState(
    atualizarApelido,
    {} as EstadoPerfil
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
        Apelido
      </h2>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="apelido" className="text-sm font-medium">
            Apelido
          </label>
          <input
            id="apelido"
            name="apelido"
            type="text"
            required
            minLength={2}
            maxLength={20}
            defaultValue={apelidoAtual}
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {estado?.erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        {estado?.sucesso && (
          <p role="status" className="text-sm text-green-600 dark:text-green-400">
            Apelido atualizado!
          </p>
        )}
        <Submit />
      </form>
    </div>
  );
}
