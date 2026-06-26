"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  entrarComSenha,
  cadastrar,
  enviarMagicLink,
  solicitarRedefinicaoSenha,
} from "@/app/entrar/actions";

type Aba = "entrar" | "criar" | "magico";
type Modo = "form" | "recuperar";

const abas: { id: Aba; label: string }[] = [
  { id: "entrar", label: "Entrar" },
  { id: "criar", label: "Criar conta" },
  { id: "magico", label: "Link mágico" },
];

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="cta" className="w-full" disabled={pending}>
      {pending ? "Aguarde..." : children}
    </Button>
  );
}

export function AuthForm() {
  const [aba, setAba] = useState<Aba>("entrar");
  const [modo, setModo] = useState<Modo>("form");

  const acao =
    aba === "entrar" ? entrarComSenha : aba === "criar" ? cadastrar : enviarMagicLink;
  const [estado, formAction] = useActionState(acao, {} as { erro?: string; ok?: string });
  const [estadoRecup, formActionRecup] = useActionState(
    solicitarRedefinicaoSenha,
    {} as { erro?: string; ok?: string }
  );

  if (modo === "recuperar") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
          Recuperar senha
        </h2>
        <form action={formActionRecup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-recup" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email-recup"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {estadoRecup?.erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {estadoRecup.erro}
            </p>
          )}
          {estadoRecup?.ok && (
            <p role="status" className="text-sm text-primary">
              {estadoRecup.ok}
            </p>
          )}
          <Submit>Enviar link de redefinição</Submit>
        </form>
        <button
          type="button"
          onClick={() => setModo("form")}
          className="mt-4 w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
      <div role="tablist" className="mb-6 flex gap-1 rounded-full bg-muted p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              aba === a.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {aba !== "magico" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={6}
              autoComplete={aba === "criar" ? "new-password" : "current-password"}
              className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {aba === "entrar" && (
              <button
                type="button"
                onClick={() => setModo("recuperar")}
                className="self-end cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                Esqueci a senha
              </button>
            )}
          </div>
        )}

        {estado?.erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        {estado?.ok && (
          <p role="status" className="text-sm text-primary">
            {estado.ok}
          </p>
        )}

        <Submit>
          {aba === "entrar"
            ? "Entrar"
            : aba === "criar"
              ? "Criar conta"
              : "Enviar link"}
        </Submit>
      </form>
    </div>
  );
}
