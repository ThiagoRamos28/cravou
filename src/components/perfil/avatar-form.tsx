"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  ESTILOS_AVATAR,
  avatarUrlFromEstilo,
  estiloDoAvatar,
} from "@/lib/avatars";
import { atualizarAvatar, type EstadoPerfil } from "@/app/perfil/actions";

const NOMES_ESTILO: Record<string, string> = {
  "fun-emoji": "Emoji",
  "adventurer": "Aventureiro",
  "bottts": "Robô",
  "pixel-art": "Pixel",
  "lorelei": "Lorelei",
};

function Submit({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending || desabilitado}
    >
      {pending ? "Salvando..." : "Salvar avatar"}
    </Button>
  );
}

export function AvatarForm({ avatarAtual }: { avatarAtual: string }) {
  const estiloInicial = estiloDoAvatar(avatarAtual);
  const [estiloAtivo, setEstiloAtivo] = useState(estiloInicial);
  const [avatarSelecionado, setAvatarSelecionado] = useState(avatarAtual);
  const [estado, formAction] = useActionState(
    atualizarAvatar,
    {} as EstadoPerfil
  );

  const seeds = ESTILOS_AVATAR[estiloAtivo] ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
        Avatar
      </h2>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="avatar_url" value={avatarSelecionado} />

        <div role="tablist" className="flex flex-wrap gap-2">
          {Object.keys(ESTILOS_AVATAR).map((estilo) => (
            <button
              key={estilo}
              type="button"
              role="tab"
              aria-selected={estiloAtivo === estilo}
              onClick={() => setEstiloAtivo(estilo)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                estiloAtivo === estilo
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted"
              }`}
            >
              {NOMES_ESTILO[estilo] ?? estilo}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="sr-only">Opções de avatar</legend>
          <div className="flex flex-wrap gap-3">
            {seeds.map((seed) => {
              const url = avatarUrlFromEstilo(estiloAtivo, seed);
              const ativo = url === avatarSelecionado;
              return (
                <label
                  key={seed}
                  className={`cursor-pointer rounded-full border-2 p-0.5 transition-colors ${
                    ativo
                      ? "border-primary"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="avatar_radio"
                    value={url}
                    checked={ativo}
                    onChange={() => setAvatarSelecionado(url)}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Avatar ${seed}`}
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
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        {estado?.sucesso && (
          <p
            role="status"
            className="text-sm text-green-600 dark:text-green-400"
          >
            Avatar atualizado!
          </p>
        )}
        <Submit desabilitado={avatarSelecionado === avatarAtual} />
      </form>
    </div>
  );
}
