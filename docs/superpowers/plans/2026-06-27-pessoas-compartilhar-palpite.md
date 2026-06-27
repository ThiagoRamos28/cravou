# Pessoas & Compartilhar Palpite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar página de descoberta de usuários (`/pessoas`) com busca e botão de follow, e modal de compartilhamento de palpite no feed após salvar.

**Architecture:** `listarUsuarios()` em `lib/feed.ts` agrega perfis + flag de follow numa query. `CompartilharModal` é um Client Component montado dentro de `PalpiteForm` quando `estado.ok` é verdadeiro. `UsuariosList` filtra em memória via `useState`. Nenhuma migration nova.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (leitura via `createClient`), lucide-react, Vitest + React Testing Library.

## Global Constraints

- Idioma da UI: Português do Brasil — todos os textos em pt-BR
- Tema: dark E light (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `text-accent`, `bg-primary`)
- Ícones: lucide-react apenas — nunca emojis como ícones
- Tipografia: `font-display` (Barlow Condensed, uppercase) para títulos; `font-sans` (Barlow) para corpo
- Botões: sempre via `Button` ou `buttonVariants()` de `@/components/ui/button`
- `"use client"` somente quando necessário (hooks, interatividade)
- Commits terminam com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Fuso: exibição em `America/Sao_Paulo`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/feed.ts` | Modificar | Adicionar `UsuarioComFollow` e `listarUsuarios()` |
| `src/app/pessoas/page.tsx` | Criar | Server Component da página /pessoas |
| `src/components/pessoas/usuarios-list.tsx` | Criar | Client Component com filtro em memória |
| `src/components/site-header.tsx` | Modificar | Link "Pessoas" no nav |
| `src/app/jogos/actions.ts` | Modificar | Ampliar `EstadoPalpite` com campos do palpite salvo |
| `src/components/palpites/__tests__/compartilhar-modal.test.tsx` | Criar | Testes do modal |
| `src/components/palpites/compartilhar-modal.tsx` | Criar | Client Component do modal de compartilhamento |
| `src/components/jogos/palpite-form.tsx` | Modificar | Integrar `CompartilharModal` após `estado.ok` |

---

## Task 1: `listarUsuarios` em `src/lib/feed.ts`

**Files:**
- Modify: `src/lib/feed.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tabelas `profiles`, `follows`
- Produces:
  - `UsuarioComFollow = PerfilBasico & { ja_sigo: boolean }`
  - `listarUsuarios(sessaoId: string): Promise<UsuarioComFollow[]>`

- [ ] **Step 1: Adicionar tipo e função ao final de `src/lib/feed.ts`**

```typescript
export type UsuarioComFollow = PerfilBasico & { ja_sigo: boolean };

export async function listarUsuarios(sessaoId: string): Promise<UsuarioComFollow[]> {
  try {
    const supabase = await createClient();

    const [{ data: perfis }, { data: seguindo }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, apelido, avatar_url")
        .not("apelido", "is", null)
        .neq("id", sessaoId)
        .order("apelido", { ascending: true }),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", sessaoId),
    ]);

    const seguindoSet = new Set((seguindo ?? []).map((f) => f.following_id as string));

    return (perfis ?? []).map((p) => ({
      id: p.id as string,
      apelido: (p.apelido as string) ?? "Usuário",
      avatar_url: p.avatar_url as string | null,
      ja_sigo: seguindoSet.has(p.id as string),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep "feed.ts"
```

Esperado: sem output (zero erros em feed.ts).

- [ ] **Step 3: Commit**

```bash
git add src/lib/feed.ts
git commit -m "feat: listarUsuarios — perfis com flag ja_sigo

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Página `/pessoas` e `UsuariosList`

**Files:**
- Create: `src/app/pessoas/page.tsx`
- Create: `src/components/pessoas/usuarios-list.tsx`
- Modify: `src/components/site-header.tsx`

**Interfaces:**
- Consumes: `listarUsuarios` e `UsuarioComFollow` de `@/lib/feed`; `getSessao` de `@/lib/auth/profile`; `FollowButton` de `@/components/perfil/follow-button`; `avatarPadrao` de `@/lib/avatars`; `SiteHeader`, `SiteFooter`
- Produces: rota `/pessoas` protegida por auth; `<UsuariosList usuarios={UsuarioComFollow[]} />`

- [ ] **Step 1: Criar `src/app/pessoas/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarUsuarios } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { UsuariosList } from "@/components/pessoas/usuarios-list";

export default async function PessoasPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const usuarios = await listarUsuarios(sessao.userId);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Pessoas
        </h1>
        <UsuariosList usuarios={usuarios} />
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/pessoas/usuarios-list.tsx`**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FollowButton } from "@/components/perfil/follow-button";
import { avatarPadrao } from "@/lib/avatars";
import type { UsuarioComFollow } from "@/lib/feed";

type UsuariosListProps = { usuarios: UsuarioComFollow[] };

export function UsuariosList({ usuarios }: UsuariosListProps) {
  const [filtro, setFiltro] = useState("");

  const filtrados = filtro.trim()
    ? usuarios.filter((u) =>
        u.apelido.toLowerCase().includes(filtro.trim().toLowerCase())
      )
    : usuarios;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Buscar por apelido..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filtrados.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {filtro ? "Nenhum usuário encontrado." : "Nenhum outro membro ainda."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtrados.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <Link
              href={`/perfil/${u.id}`}
              className="flex min-w-0 items-center gap-3 hover:underline"
            >
              <img
                src={u.avatar_url ?? avatarPadrao(u.id)}
                alt={u.apelido}
                width={36}
                height={36}
                className="shrink-0 rounded-full"
              />
              <span className="truncate font-medium">{u.apelido}</span>
            </Link>
            <FollowButton followingId={u.id} isSeguindoInicial={u.ja_sigo} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar link "Pessoas" ao SiteHeader**

Em `src/components/site-header.tsx`, adicione o link **antes** do link "Feed" existente:

```typescript
// Adicionar antes do link href="/feed":
<Link
  href="/pessoas"
  className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
>
  Pessoas
</Link>
```

O bloco nav completo fica:

```typescript
<nav className="flex items-center gap-0.5 sm:gap-1">
  <Link
    href="/pessoas"
    className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
  >
    Pessoas
  </Link>
  <Link
    href="/feed"
    className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
  >
    Feed
  </Link>
  <Link
    href="/jogos"
    className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
  >
    Jogos
  </Link>
  <Link
    href="/ranking"
    className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
  >
    Ranking
  </Link>
  <Link
    href="/historico"
    className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
  >
    Histórico
  </Link>
</nav>
```

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "(pessoas|usuarios-list|site-header)"
```

Esperado: sem output.

- [ ] **Step 5: Commit**

```bash
git add src/app/pessoas/page.tsx src/components/pessoas/usuarios-list.tsx src/components/site-header.tsx
git commit -m "feat: página /pessoas com busca e follow button

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Ampliar `EstadoPalpite` e `salvarPalpite`

**Files:**
- Modify: `src/app/jogos/actions.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type EstadoPalpite = {
    erro?: string;
    ok?: string;
    jogoId?: string;
    timeCasa?: string;
    timeFora?: string;
    palpiteCasa?: number;
    palpiteFora?: number;
  };
  ```
  — `salvarPalpite` retorna esses campos extras quando bem-sucedido.

- [ ] **Step 1: Ampliar o tipo e o retorno em `src/app/jogos/actions.ts`**

Substitua a linha do tipo e o retorno de sucesso:

```typescript
// Tipo atualizado (linha 10):
export type EstadoPalpite = {
  erro?: string;
  ok?: string;
  jogoId?: string;
  timeCasa?: string;
  timeFora?: string;
  palpiteCasa?: number;
  palpiteFora?: number;
};
```

Para obter `timeCasa` e `timeFora`, adicione um campo oculto no formulário via `PalpiteForm` — mas é mais simples buscar no banco após o upsert. Alternativa ainda mais simples: passar `time_casa` e `time_fora` via `FormData` com hidden inputs no `PalpiteForm`.

Adicione hidden inputs em `PalpiteForm` (veja Task 4), e leia-os na action:

```typescript
// Em salvarPalpite, após validação, adicione:
const timeCasa = String(formData.get("time_casa") ?? "");
const timeFora = String(formData.get("time_fora") ?? "");

// E substitua o return de sucesso:
return {
  ok: "Palpite salvo!",
  jogoId: matchId,
  timeCasa,
  timeFora,
  palpiteCasa: v.dados.palpite_casa,
  palpiteFora: v.dados.palpite_fora,
};
```

O arquivo completo resultante de `src/app/jogos/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validar } from "@/lib/auth/validation";
import { palpiteSchema } from "@/lib/palpites/validation";
import { palpiteAberto } from "@/lib/palpites/corte";
import { getMinutosCorte } from "@/lib/predictions";

export type EstadoPalpite = {
  erro?: string;
  ok?: string;
  jogoId?: string;
  timeCasa?: string;
  timeFora?: string;
  palpiteCasa?: number;
  palpiteFora?: number;
};

export async function salvarPalpite(
  _prev: EstadoPalpite,
  formData: FormData
): Promise<EstadoPalpite> {
  const matchId = String(formData.get("match_id") ?? "");
  const inicioEm = String(formData.get("inicio_em") ?? "");
  if (!matchId || !inicioEm) return { erro: "Jogo inválido." };

  const timeCasa = String(formData.get("time_casa") ?? "");
  const timeFora = String(formData.get("time_fora") ?? "");

  const v = validar(palpiteSchema, {
    palpite_casa: formData.get("palpite_casa"),
    palpite_fora: formData.get("palpite_fora"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const minutosCorte = await getMinutosCorte();
  if (!palpiteAberto(inicioEm, minutosCorte)) {
    return { erro: "O prazo para palpitar neste jogo já encerrou." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login para palpitar." };

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      palpite_casa: v.dados.palpite_casa,
      palpite_fora: v.dados.palpite_fora,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );

  if (error) return { erro: "Não foi possível salvar o palpite." };

  revalidatePath("/jogos");
  return {
    ok: "Palpite salvo!",
    jogoId: matchId,
    timeCasa,
    timeFora,
    palpiteCasa: v.dados.palpite_casa,
    palpiteFora: v.dados.palpite_fora,
  };
}
```

- [ ] **Step 2: Verificar que os testes existentes ainda passam**

```bash
npx vitest run src/components/jogos/__tests__/palpite-form.test.tsx 2>&1 | tail -10
```

Esperado: PASS (os testes existentes não verificam os campos novos, apenas comportamento de submit).

- [ ] **Step 3: Commit**

```bash
git add src/app/jogos/actions.ts
git commit -m "feat: EstadoPalpite retorna dados do palpite salvo para o modal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `CompartilharModal` + integração em `PalpiteForm`

**Files:**
- Create: `src/components/palpites/__tests__/compartilhar-modal.test.tsx`
- Create: `src/components/palpites/compartilhar-modal.tsx`
- Modify: `src/components/jogos/palpite-form.tsx`

**Interfaces:**
- Consumes: `publicarPost` de `@/app/feed/actions`; `traduzirPais` de `@/lib/i18n/paises`
- Produces:
  ```typescript
  // Props de CompartilharModal:
  type CompartilharModalProps = {
    jogoId: string;
    timeCasa: string;
    timeFora: string;
    palpiteCasa: number;
    palpiteFora: number;
    onClose: () => void;
  };
  ```

- [ ] **Step 1: Escrever testes**

Crie `src/components/palpites/__tests__/compartilhar-modal.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompartilharModal } from "../compartilhar-modal";

vi.mock("@/app/feed/actions", () => ({
  publicarPost: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/i18n/paises", () => ({
  traduzirPais: (nome: string) => nome,
}));

const props = {
  jogoId: "jogo-1",
  timeCasa: "Brazil",
  timeFora: "Argentina",
  palpiteCasa: 2,
  palpiteFora: 1,
  onClose: vi.fn(),
};

describe("CompartilharModal", () => {
  it("exibe o mini-card com os times e placar do palpite", () => {
    render(<CompartilharModal {...props} />);
    expect(screen.getByText("Brazil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("2 × 1")).toBeTruthy();
  });

  it("pré-preenche o textarea com texto de sugestão", () => {
    render(<CompartilharModal {...props} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("2 × 1");
  });

  it("botão Pular chama onClose sem publicar", async () => {
    const { publicarPost } = await import("@/app/feed/actions");
    render(<CompartilharModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /pular/i }));
    expect(props.onClose).toHaveBeenCalled();
    expect(publicarPost).not.toHaveBeenCalled();
  });

  it("botão Postar chama publicarPost com jogoId e fecha modal", async () => {
    const { publicarPost } = await import("@/app/feed/actions");
    render(<CompartilharModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /postar/i }));
    expect(publicarPost).toHaveBeenCalledWith(expect.any(String), "jogo-1");
    expect(props.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/palpites/__tests__/compartilhar-modal.test.tsx 2>&1 | tail -10
```

Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Criar `src/components/palpites/compartilhar-modal.tsx`**

```typescript
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
          {/* Mini-card do palpite */}
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
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/components/palpites/__tests__/compartilhar-modal.test.tsx 2>&1 | tail -10
```

Esperado: PASS.

- [ ] **Step 5: Integrar modal em `PalpiteForm`**

Em `src/components/jogos/palpite-form.tsx`, adicione:

1. Import do modal e `useState` (já importado):
```typescript
import { CompartilharModal } from "@/components/palpites/compartilhar-modal";
```

2. Estado local para controlar visibilidade do modal após cada submit:
```typescript
const [modalFechado, setModalFechado] = useState(false);
```

3. Reset do `modalFechado` quando um novo submit acontece (adicionar ao `useEffect` de `estado.ok`):
```typescript
useEffect(() => {
  if (estado.ok) {
    toast({ message: "Palpite salvo!", variant: "success" });
    setModalFechado(false);  // permite o modal aparecer novamente
  }
}, [estado.ok, toast]);
```

4. Renderizar o modal logo antes do `return` do JSX principal (dentro do componente, antes do `return`):
```typescript
const mostrarModal =
  !modalFechado &&
  !!estado.ok &&
  !!estado.jogoId &&
  estado.palpiteCasa !== undefined &&
  estado.palpiteFora !== undefined;
```

5. Adicionar o modal dentro do JSX — adicione imediatamente antes do fechamento do `<motion.div key="open">` que envolve o formulário aberto:

```typescript
{mostrarModal && (
  <CompartilharModal
    jogoId={estado.jogoId!}
    timeCasa={estado.timeCasa ?? match.time_casa}
    timeFora={estado.timeFora ?? match.time_fora}
    palpiteCasa={estado.palpiteCasa!}
    palpiteFora={estado.palpiteFora!}
    onClose={() => setModalFechado(true)}
  />
)}
```

6. Adicionar hidden inputs `time_casa` e `time_fora` dentro do `<form>` para a action recebê-los:
```typescript
<input type="hidden" name="time_casa" value={match.time_casa} />
<input type="hidden" name="time_fora" value={match.time_fora} />
```

O arquivo completo de `src/components/jogos/palpite-form.tsx` após as alterações:

```typescript
"use client";

import { useActionState, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { salvarPalpite, type EstadoPalpite } from "@/app/jogos/actions";
import { palpiteAberto } from "@/lib/palpites/corte";
import { CompartilharModal } from "@/components/palpites/compartilhar-modal";
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";

export function PalpiteForm({
  match,
  palpite,
  minutosCorte,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte: number;
}) {
  const [estado, formAction, pending] = useActionState(
    salvarPalpite,
    {} as EstadoPalpite
  );
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [modalFechado, setModalFechado] = useState(false);

  useEffect(() => {
    if (estado.ok) {
      toast({ message: "Palpite salvo!", variant: "success" });
      setModalFechado(false);
    }
  }, [estado.ok, toast]);

  useEffect(() => {
    if (estado.erro) toast({ message: estado.erro, variant: "error" });
  }, [estado.erro, toast]);

  const aberto =
    match.status === "agendado" && palpiteAberto(match.inicio_em, minutosCorte);

  const offset = reduce ? 0 : 8;

  const mostrarModal =
    !modalFechado &&
    !!estado.ok &&
    !!estado.jogoId &&
    estado.palpiteCasa !== undefined &&
    estado.palpiteFora !== undefined;

  if (!aberto) {
    const pontuado =
      match.status === "finalizado" && palpite && palpite.pontos != null;
    const cravou =
      pontuado &&
      palpite!.palpite_casa === match.placar_casa &&
      palpite!.palpite_fora === match.placar_fora;

    return (
      <motion.div
        className="mt-3"
        initial={{ opacity: 0, y: offset }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`flex items-center justify-center gap-2 text-xs ${palpite ? "text-foreground" : "text-muted-foreground"}`}>
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Palpites encerrados
            {palpite ? `: ${palpite.palpite_casa} × ${palpite.palpite_fora}` : ""}
          </span>
        </div>
        {pontuado && (
          <motion.div
            className="mt-1.5"
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {cravou ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Cravou! +{palpite!.pontos} pts
              </span>
            ) : (
              <span
                className={`text-xs font-semibold ${
                  palpite!.pontos! > 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                +{palpite!.pontos} pts
              </span>
            )}
          </motion.div>
        )}
        {/* Hidden but accessible inputs so tests can query them as disabled */}
        <label className="sr-only" htmlFor={`casa-${match.id}`}>
          Palpite {match.time_casa}
        </label>
        <input
          id={`casa-${match.id}`}
          name="palpite_casa"
          type="number"
          min={0}
          defaultValue={palpite?.palpite_casa ?? ""}
          className="sr-only"
          disabled
          aria-hidden="false"
        />
        <label className="sr-only" htmlFor={`fora-${match.id}`}>
          Palpite {match.time_fora}
        </label>
        <input
          id={`fora-${match.id}`}
          name="palpite_fora"
          type="number"
          min={0}
          defaultValue={palpite?.palpite_fora ?? ""}
          className="sr-only"
          disabled
          aria-hidden="false"
        />
      </motion.div>
    );
  }

  return (
    <>
      {mostrarModal && (
        <CompartilharModal
          jogoId={estado.jogoId!}
          timeCasa={estado.timeCasa ?? match.time_casa}
          timeFora={estado.timeFora ?? match.time_fora}
          palpiteCasa={estado.palpiteCasa!}
          palpiteFora={estado.palpiteFora!}
          onClose={() => setModalFechado(true)}
        />
      )}
      <motion.div
        key="open"
        className="mt-3"
        initial={{ opacity: reduce ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: reduce ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
      >
        <form action={formAction} className="flex flex-wrap items-center justify-center gap-2">
          <input type="hidden" name="match_id" value={match.id} />
          <input type="hidden" name="inicio_em" value={match.inicio_em} />
          <input type="hidden" name="time_casa" value={match.time_casa} />
          <input type="hidden" name="time_fora" value={match.time_fora} />
          <span className="text-xs text-muted-foreground">Seu palpite:</span>
          <label className="sr-only" htmlFor={`casa-${match.id}`}>
            Palpite {match.time_casa}
          </label>
          <input
            id={`casa-${match.id}`}
            name="palpite_casa"
            type="number"
            min={0}
            defaultValue={palpite?.palpite_casa ?? ""}
            className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
          />
          <span className="text-muted-foreground">×</span>
          <label className="sr-only" htmlFor={`fora-${match.id}`}>
            Palpite {match.time_fora}
          </label>
          <input
            id={`fora-${match.id}`}
            name="palpite_fora"
            type="number"
            min={0}
            defaultValue={palpite?.palpite_fora ?? ""}
            className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-center"
          />
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          {estado?.erro && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {estado.erro}
            </span>
          )}
          {estado?.ok && (
            <motion.span
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-primary"
            >
              {estado.ok}
            </motion.span>
          )}
        </form>
      </motion.div>
    </>
  );
}
```

- [ ] **Step 6: Rodar todos os testes**

```bash
npm test 2>&1 | tail -15
```

Esperado: todos passando.

- [ ] **Step 7: Build de produção**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build sem erros, rota `/pessoas` presente na lista.

- [ ] **Step 8: Commit**

```bash
git add src/components/palpites/compartilhar-modal.tsx src/components/palpites/__tests__/compartilhar-modal.test.tsx src/components/jogos/palpite-form.tsx
git commit -m "feat: CompartilharModal — compartilhar palpite no feed após salvar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
