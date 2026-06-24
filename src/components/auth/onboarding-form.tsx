"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { salvarPerfil } from "@/app/onboarding/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="cta" className="w-full" disabled={pending}>
      {pending ? "Salvando..." : "Começar a palpitar"}
    </Button>
  );
}

export function OnboardingForm({
  avatares,
  apelidoInicial,
  avatarInicial,
}: {
  avatares: string[];
  apelidoInicial: string;
  avatarInicial: string;
}) {
  const [avatar, setAvatar] = useState(avatarInicial);
  const [estado, formAction] = useActionState(salvarPerfil, {} as { erro?: string });

  return (
    <form
      action={formAction}
      className="w-full max-w-md rounded-2xl border border-border bg-card p-6"
    >
      <div className="mb-5 flex flex-col gap-1.5">
        <label htmlFor="apelido" className="text-sm font-medium">
          Seu apelido
        </label>
        <input
          id="apelido"
          name="apelido"
          type="text"
          required
          minLength={2}
          maxLength={20}
          defaultValue={apelidoInicial}
          placeholder="Como a galera te chama?"
          className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-medium">Escolha seu avatar</legend>
        <input type="hidden" name="avatar_url" value={avatar} />
        <div className="flex flex-wrap gap-3">
          {avatares.map((url) => {
            const ativo = url === avatar;
            return (
              <label
                key={url}
                className={`cursor-pointer rounded-full border-2 p-0.5 transition-colors ${
                  ativo ? "border-primary" : "border-transparent hover:border-border"
                }`}
              >
                <input
                  type="radio"
                  name="avatar_radio"
                  value={url}
                  checked={ativo}
                  onChange={() => setAvatar(url)}
                  className="sr-only"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Opção de avatar"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full bg-muted"
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      {estado?.erro && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {estado.erro}
        </p>
      )}

      <Submit />
    </form>
  );
}
