# Palpites dos Amigos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir visualizar palpites de pessoas seguidas numa aba `/feed/palpites`, e corrigir RLS para que o grid de palpites no perfil público funcione.

**Architecture:** Migration adiciona política RLS de leitura pública em `predictions`. `listarPalpitesAmigos` em `lib/feed.ts` agrega predictions das pessoas seguidas com dados do autor e do jogo. Uma Server Action expõe paginação. `FeedTabs` é um componente de navegação compartilhado entre `/feed` e `/feed/palpites`. `PalpiteAmigoCard` e `PalpitesAmigosList` renderizam a lista paginada.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase MCP, lucide-react, Vitest + React Testing Library.

## Global Constraints

- Idioma da UI: Português do Brasil
- Tema: dark E light (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `text-accent`, `bg-primary`)
- Ícones: lucide-react apenas
- Botões: `Button` ou `buttonVariants()` de `@/components/ui/button`
- `"use client"` somente quando necessário
- Commits terminam com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Fuso: exibição em `America/Sao_Paulo`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| *(migration Supabase)* | Criar | Adicionar `predictions_select_all` |
| `src/lib/feed.ts` | Modificar | Adicionar `PalpiteAmigo` e `listarPalpitesAmigos()` |
| `src/app/feed/actions.ts` | Modificar | Adicionar `carregarMaisPalpites()` |
| `src/components/feed/feed-tabs.tsx` | Criar | Client Component tabs Posts/Palpites |
| `src/components/feed/palpite-amigo-card.tsx` | Criar | Card do palpite com autor |
| `src/components/feed/__tests__/palpite-amigo-card.test.tsx` | Criar | Testes do card |
| `src/components/feed/palpites-amigos-list.tsx` | Criar | Lista paginada de palpites |
| `src/app/feed/palpites/page.tsx` | Criar | Server Component da aba /feed/palpites |
| `src/app/feed/page.tsx` | Modificar | Adicionar FeedTabs |

---

## Task 1: Migration RLS + data layer

**Files:**
- Apply migration via Supabase MCP
- Modify: `src/lib/feed.ts`

**Interfaces:**
- Produces:
  - `PalpiteAmigo` — tipo exportado de `src/lib/feed.ts`
  - `listarPalpitesAmigos(sessaoId: string, offset?: number): Promise<PalpiteAmigo[]>`

- [ ] **Step 1: Aplicar migration RLS**

Use `mcp__supabase-cravou__apply_migration` com:
- name: `predictions_select_all`
- query:

```sql
create policy "predictions_select_all" on predictions
  for select using (auth.uid() is not null);
```

- [ ] **Step 2: Adicionar tipo `PalpiteAmigo` e função `listarPalpitesAmigos` em `src/lib/feed.ts`**

Adicione ao final do arquivo `src/lib/feed.ts` (após `listarUsuarios`):

```typescript
export type PalpiteAmigo = PalpiteResumido & {
  autor: { id: string; apelido: string; avatar_url: string | null };
  feito_em: string;
};

const PALPITE_LIMIT = 20;

export async function listarPalpitesAmigos(
  sessaoId: string,
  offset: number = 0
): Promise<PalpiteAmigo[]> {
  try {
    const supabase = await createClient();

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", sessaoId);

    const amigos = (follows ?? []).map((f) => f.following_id as string);
    if (amigos.length === 0) return [];

    const { data } = await supabase
      .from("predictions")
      .select(
        "palpite_casa, palpite_fora, pontos, created_at, " +
          "autor:profiles!predictions_user_id_fkey(id, apelido, avatar_url), " +
          "match:matches!predictions_match_id_fkey(" +
          "id, time_casa, time_fora, bandeira_casa, bandeira_fora, " +
          "placar_casa, placar_fora, status" +
          ")"
      )
      .in("user_id", amigos)
      .order("created_at", { ascending: false })
      .range(offset, offset + PALPITE_LIMIT - 1);

    type RawPA = {
      palpite_casa: number;
      palpite_fora: number;
      pontos: number | null;
      created_at: string;
      autor: { id: string; apelido: string | null; avatar_url: string | null } | null;
      match: {
        id: string;
        time_casa: string;
        time_fora: string;
        bandeira_casa: string | null;
        bandeira_fora: string | null;
        placar_casa: number | null;
        placar_fora: number | null;
        status: "agendado" | "ao_vivo" | "finalizado";
      };
    };

    return (data ?? []).map((r) => {
      const row = r as unknown as RawPA;
      const m = row.match;
      return {
        jogo_id: m.id,
        time_casa: m.time_casa,
        time_fora: m.time_fora,
        bandeira_casa: m.bandeira_casa,
        bandeira_fora: m.bandeira_fora,
        palpite_casa: row.palpite_casa,
        palpite_fora: row.palpite_fora,
        placar_casa: m.placar_casa,
        placar_fora: m.placar_fora,
        status: m.status,
        pontos: row.pontos,
        feito_em: row.created_at,
        autor: {
          id: row.autor?.id ?? "",
          apelido: row.autor?.apelido ?? "Usuário",
          avatar_url: row.autor?.avatar_url ?? null,
        },
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep "feed.ts"
```

Esperado: sem output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/feed.ts
git commit -m "feat: RLS predictions_select_all + listarPalpitesAmigos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Server Action `carregarMaisPalpites` + `FeedTabs`

**Files:**
- Modify: `src/app/feed/actions.ts`
- Create: `src/components/feed/feed-tabs.tsx`

**Interfaces:**
- Consumes: `listarPalpitesAmigos` de `@/lib/feed`
- Produces:
  - `carregarMaisPalpites(offset: number, userId: string): Promise<PalpiteAmigo[]>` — exportado de `src/app/feed/actions.ts`
  - `<FeedTabs abaAtiva="posts" | "palpites" />` — exportado de `src/components/feed/feed-tabs.tsx`

- [ ] **Step 1: Adicionar import e action em `src/app/feed/actions.ts`**

Adicione ao topo do arquivo, na linha de imports existente de `lib/feed`:

```typescript
import { listarPosts, listarPalpitesAmigos, type PostFeed, type PalpiteAmigo } from "@/lib/feed";
```

Substitua a linha de import existente:
```typescript
// Antes:
import { listarPosts, type PostFeed } from "@/lib/feed";
// Depois:
import { listarPosts, listarPalpitesAmigos, type PostFeed, type PalpiteAmigo } from "@/lib/feed";
```

Adicione ao final do arquivo:

```typescript
export async function carregarMaisPalpites(
  offset: number,
  userId: string
): Promise<PalpiteAmigo[]> {
  return listarPalpitesAmigos(userId, offset);
}
```

- [ ] **Step 2: Criar `src/components/feed/feed-tabs.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedTabs() {
  const pathname = usePathname();
  const abaAtiva = pathname === "/feed/palpites" ? "palpites" : "posts";

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
      <Link
        href="/feed"
        className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
          abaAtiva === "posts"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Posts
      </Link>
      <Link
        href="/feed/palpites"
        className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
          abaAtiva === "palpites"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Palpites
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "(feed/actions|feed-tabs)"
```

Esperado: sem output.

- [ ] **Step 4: Commit**

```bash
git add src/app/feed/actions.ts src/components/feed/feed-tabs.tsx
git commit -m "feat: carregarMaisPalpites action e FeedTabs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: PalpiteAmigoCard + PalpitesAmigosList

**Files:**
- Create: `src/components/feed/__tests__/palpite-amigo-card.test.tsx`
- Create: `src/components/feed/palpite-amigo-card.tsx`
- Create: `src/components/feed/palpites-amigos-list.tsx`

**Interfaces:**
- Consumes: `PalpiteAmigo` de `@/lib/feed`; `carregarMaisPalpites` de `@/app/feed/actions`; `avatarPadrao` de `@/lib/avatars`; `traduzirPais` de `@/lib/i18n/paises`; `Button` de `@/components/ui/button`
- Produces:
  - `<PalpiteAmigoCard palpite={PalpiteAmigo} />`
  - `<PalpitesAmigosList palpitesIniciais={PalpiteAmigo[]} userId={string} />`

- [ ] **Step 1: Escrever testes**

Crie `src/components/feed/__tests__/palpite-amigo-card.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteAmigoCard } from "../palpite-amigo-card";
import type { PalpiteAmigo } from "@/lib/feed";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n/paises", () => ({
  traduzirPais: (nome: string) => nome,
}));

const base: PalpiteAmigo = {
  jogo_id: "j1",
  time_casa: "Brazil",
  time_fora: "Argentina",
  bandeira_casa: null,
  bandeira_fora: null,
  palpite_casa: 2,
  palpite_fora: 1,
  placar_casa: null,
  placar_fora: null,
  status: "agendado",
  pontos: null,
  feito_em: new Date().toISOString(),
  autor: { id: "u1", apelido: "Thiago", avatar_url: null },
};

describe("PalpiteAmigoCard", () => {
  it("exibe o apelido do autor", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Thiago")).toBeTruthy();
  });

  it("exibe os times", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Brazil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
  });

  it("exibe o placar do palpite", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("2 × 1")).toBeTruthy();
  });

  it("exibe badge Aguardando para jogo agendado", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Aguardando")).toBeTruthy();
  });

  it("exibe badge Exato para placar exato", () => {
    render(
      <PalpiteAmigoCard
        palpite={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/exato/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/feed/__tests__/palpite-amigo-card.test.tsx 2>&1 | tail -8
```

Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Criar `src/components/feed/palpite-amigo-card.tsx`**

```typescript
import Link from "next/link";
import { avatarPadrao } from "@/lib/avatars";
import { traduzirPais } from "@/lib/i18n/paises";
import type { PalpiteAmigo } from "@/lib/feed";

type Badge = "aguardando" | "exato" | "resultado" | "erro";

function calcBadge(p: PalpiteAmigo): Badge {
  if (p.status !== "finalizado" || p.placar_casa === null || p.placar_fora === null)
    return "aguardando";
  if (p.palpite_casa === p.placar_casa && p.palpite_fora === p.placar_fora)
    return "exato";
  const resultadoPalpite = Math.sign(p.palpite_casa - p.palpite_fora);
  const resultadoReal = Math.sign(p.placar_casa - p.placar_fora);
  return resultadoPalpite === resultadoReal ? "resultado" : "erro";
}

const BADGE_STYLES: Record<Badge, string> = {
  aguardando: "bg-muted text-muted-foreground",
  exato: "bg-accent/15 text-accent",
  resultado: "bg-primary/15 text-primary",
  erro: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const BADGE_LABELS: Record<Badge, string> = {
  aguardando: "Aguardando",
  exato: "Exato",
  resultado: "Resultado",
  erro: "Erro",
};

function tempoRelativo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(isoStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

type PalpiteAmigoCardProps = { palpite: PalpiteAmigo };

export function PalpiteAmigoCard({ palpite: p }: PalpiteAmigoCardProps) {
  const badge = calcBadge(p);
  const avatarUrl = p.autor.avatar_url ?? avatarPadrao(p.autor.id);

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/perfil/${p.autor.id}`}
          className="flex items-center gap-2 hover:underline"
        >
          <img
            src={avatarUrl}
            alt={p.autor.apelido}
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="text-sm font-semibold">{p.autor.apelido}</span>
        </Link>
        <time
          dateTime={p.feito_em}
          className="text-xs text-muted-foreground"
        >
          {tempoRelativo(p.feito_em)}
        </time>
      </div>

      <div className="rounded-xl border border-border bg-muted px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1">
            {p.bandeira_casa && (
              <img src={p.bandeira_casa} alt="" width={14} height={10} />
            )}
            <span>{traduzirPais(p.time_casa)}</span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <span>{traduzirPais(p.time_fora)}</span>
            {p.bandeira_fora && (
              <img src={p.bandeira_fora} alt="" width={14} height={10} />
            )}
          </div>
        </div>

        <div className="text-center text-lg font-bold tabular-nums">
          {p.palpite_casa} × {p.palpite_fora}
        </div>

        {p.status === "finalizado" && p.placar_casa !== null && (
          <div className="mt-1 text-center text-xs text-muted-foreground">
            Resultado: {p.placar_casa} × {p.placar_fora}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[badge]}`}
        >
          {BADGE_LABELS[badge]}
        </span>
        {badge !== "aguardando" && p.pontos !== null && (
          <span className="text-xs font-semibold text-muted-foreground">
            +{p.pontos} pts
          </span>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/components/feed/__tests__/palpite-amigo-card.test.tsx 2>&1 | tail -8
```

Esperado: PASS.

- [ ] **Step 5: Criar `src/components/feed/palpites-amigos-list.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { PalpiteAmigoCard } from "./palpite-amigo-card";
import { carregarMaisPalpites } from "@/app/feed/actions";
import type { PalpiteAmigo } from "@/lib/feed";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

type PalpitesAmigosListProps = {
  palpitesIniciais: PalpiteAmigo[];
  userId: string;
};

export function PalpitesAmigosList({ palpitesIniciais, userId }: PalpitesAmigosListProps) {
  const [palpites, setPalpites] = useState(palpitesIniciais);
  const [offset, setOffset] = useState(palpitesIniciais.length);
  const [temMais, setTemMais] = useState(palpitesIniciais.length === PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  function handleCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisPalpites(offset, userId);
      setPalpites((prev) => [...prev, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < PAGE_SIZE) setTemMais(false);
    });
  }

  if (palpites.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Siga pessoas para ver os palpites delas aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {palpites.map((p, i) => (
        <PalpiteAmigoCard key={`${p.autor.id}-${p.jogo_id}-${i}`} palpite={p} />
      ))}
      {temMais && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCarregarMais}
            disabled={isPending}
          >
            {isPending ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verificar que compila**

```bash
npx tsc --noEmit 2>&1 | grep -E "(palpite-amigo|palpites-amigos)"
```

Esperado: sem output.

- [ ] **Step 7: Commit**

```bash
git add src/components/feed/palpite-amigo-card.tsx src/components/feed/__tests__/palpite-amigo-card.test.tsx src/components/feed/palpites-amigos-list.tsx
git commit -m "feat: PalpiteAmigoCard e PalpitesAmigosList

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Página `/feed/palpites` + atualizar `/feed`

**Files:**
- Create: `src/app/feed/palpites/page.tsx`
- Modify: `src/app/feed/page.tsx`

**Interfaces:**
- Consumes: `listarPalpitesAmigos` de `@/lib/feed`; `getSessao` de `@/lib/auth/profile`; `FeedTabs`, `PalpitesAmigosList`, `SiteHeader`, `SiteFooter`

- [ ] **Step 1: Criar `src/app/feed/palpites/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarPalpitesAmigos } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { PalpitesAmigosList } from "@/components/feed/palpites-amigos-list";

export default async function FeedPalpitesPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const palpites = await listarPalpitesAmigos(sessao.userId);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Feed
        </h1>
        <div className="flex flex-col gap-4">
          <FeedTabs />
          <PalpitesAmigosList
            palpitesIniciais={palpites}
            userId={sessao.userId}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `src/app/feed/page.tsx`**

Adicione o import de `FeedTabs` e insira o componente entre o título e o `PostComposer`. O arquivo completo:

```typescript
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarPosts, listarPerfis, listarJogosParaComposer } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostComposer } from "@/components/feed/post-composer";
import { PostList } from "@/components/feed/post-list";
import { FeedTabs } from "@/components/feed/feed-tabs";

export default async function FeedPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [posts, perfis, jogos] = await Promise.all([
    listarPosts(sessao.userId),
    listarPerfis(),
    listarJogosParaComposer(),
  ]);

  const perfisMap: Record<string, string> = {};
  for (const p of perfis) {
    if (p.apelido) perfisMap[p.apelido] = p.id;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Feed
        </h1>
        <div className="flex flex-col gap-4">
          <FeedTabs />
          <PostComposer jogos={jogos} perfis={perfis} />
          <PostList
            postsIniciais={posts}
            perfisMap={perfisMap}
            userId={sessao.userId}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npm test 2>&1 | tail -10
```

Esperado: todos passando.

- [ ] **Step 4: Build de produção**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build sem erros, rota `/feed/palpites` presente na lista.

- [ ] **Step 5: Commit**

```bash
git add src/app/feed/palpites/page.tsx src/app/feed/page.tsx
git commit -m "feat: página /feed/palpites com abas de navegação

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
