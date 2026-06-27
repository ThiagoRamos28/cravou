# Camada Social — Feed, Follows e Perfil Expandido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar feed global de posts curtos, follows como métrica social, curtidas com `@menção` e grade de últimos palpites no perfil.

**Architecture:** Três migrations Supabase criam as tabelas `posts`, `follows`, `post_curtidas` com RLS. Uma camada de dados em `lib/feed.ts` expõe queries tipadas. Server Actions em `src/app/feed/actions.ts` centralizam escrita. Componentes React são Server Components por padrão; apenas composer, card interativo, lista paginada, follow button e modal de seguidores são Client Components.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (RLS + Server Actions), lucide-react, Vitest + React Testing Library.

## Global Constraints

- Idioma da UI: Português do Brasil — todos os textos em pt-BR
- Tema: funcionar em dark E light (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `text-accent`, `bg-primary`)
- Ícones: lucide-react apenas — nunca emojis como ícones
- Tipografia: `font-display` (Barlow Condensed, uppercase) para títulos; `font-sans` (Barlow) para corpo
- Botões: sempre via `Button` ou `buttonVariants()` de `@/components/ui/button`
- Animações: respeitar `prefers-reduced-motion` se usar Framer Motion
- Fuso horário: exibição em `America/Sao_Paulo`; `created_at` armazenado em UTC
- Commits: mensagem termina com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Nenhum segredo no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `"use client"` somente quando estritamente necessário (hooks, Framer Motion, interatividade)
- TDD: escreva o teste primeiro, veja falhar, implemente, veja passar, commit

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| *(Supabase migration)* | Criar | Tabelas posts, follows, post_curtidas + RLS |
| `src/lib/feed.ts` | Criar | Tipos e queries de leitura do feed/perfil social |
| `src/app/feed/actions.ts` | Criar | Server Actions: publicar, curtir, seguir, deletar, paginar |
| `src/components/feed/mencao-link.tsx` | Criar | Parseia @apelido em texto → links React |
| `src/components/feed/__tests__/mencao-link.test.tsx` | Criar | Testes unitários de parseMencoes |
| `src/components/feed/post-card.tsx` | Criar | Card de post com curtida otimista e menu deletar |
| `src/components/feed/__tests__/post-card.test.tsx` | Criar | Testes do PostCard |
| `src/components/feed/post-composer.tsx` | Criar | Composer com contador, vínculo a jogo, popover @menção |
| `src/components/feed/post-list.tsx` | Criar | Lista de posts + botão "Carregar mais" |
| `src/app/feed/page.tsx` | Criar | Página /feed protegida (Server Component) |
| `src/components/perfil/palpite-card-compacto.tsx` | Criar | Card médio de palpite para a grade |
| `src/components/perfil/__tests__/palpite-card-compacto.test.tsx` | Criar | Testes dos badges de resultado |
| `src/components/perfil/palpites-grid.tsx` | Criar | Grid 2×5 dos últimos palpites |
| `src/components/perfil/metricas-sociais.tsx` | Criar | "X seguidores · Y seguindo" clicáveis |
| `src/components/perfil/followers-modal.tsx` | Criar | Modal abas Seguidores / Seguindo |
| `src/components/perfil/follow-button.tsx` | Criar | Seguir / Deixar de seguir (Client, otimista) |
| `src/app/perfil/[id]/page.tsx` | Criar | Perfil público read-only |
| `src/app/perfil/page.tsx` | Modificar | Adicionar MetricasSociais + PalpitesGrid |
| `src/components/site-header.tsx` | Modificar | Adicionar link "Feed" ao nav |
| `src/lib/auth/profile.ts` | Modificar | Adicionar getSessaoId() helper |

---

## Task 1: Migrations Supabase

**Files:**
- Apply via Supabase MCP tool `mcp__supabase-cravou__apply_migration` (3 migrations)

**Interfaces:**
- Produces: tabelas `posts`, `follows`, `post_curtidas` com RLS no banco

- [ ] **Step 1: Aplicar migration — tabela `posts`**

Use a ferramenta `mcp__supabase-cravou__apply_migration` com:
- name: `create_posts`
- query:

```sql
create table posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  conteudo    text not null check (char_length(conteudo) between 1 and 140),
  jogo_id     uuid references matches(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table posts enable row level security;

create policy "posts_select" on posts
  for select using (auth.uid() is not null);

create policy "posts_insert" on posts
  for insert with check (auth.uid() = user_id);

create policy "posts_delete" on posts
  for delete using (auth.uid() = user_id);

create index posts_created_at_idx on posts (created_at desc);
create index posts_user_id_idx on posts (user_id);
```

- [ ] **Step 2: Aplicar migration — tabela `follows`**

Use `mcp__supabase-cravou__apply_migration` com:
- name: `create_follows`
- query:

```sql
create table follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

alter table follows enable row level security;

create policy "follows_select" on follows
  for select using (auth.uid() is not null);

create policy "follows_insert" on follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete" on follows
  for delete using (auth.uid() = follower_id);

create index follows_follower_idx on follows (follower_id);
create index follows_following_idx on follows (following_id);
```

- [ ] **Step 3: Aplicar migration — tabela `post_curtidas`**

Use `mcp__supabase-cravou__apply_migration` com:
- name: `create_post_curtidas`
- query:

```sql
create table post_curtidas (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_curtidas enable row level security;

create policy "curtidas_select" on post_curtidas
  for select using (auth.uid() is not null);

create policy "curtidas_insert" on post_curtidas
  for insert with check (auth.uid() = user_id);

create policy "curtidas_delete" on post_curtidas
  for delete using (auth.uid() = user_id);

create index curtidas_post_id_idx on post_curtidas (post_id);
```

- [ ] **Step 4: Verificar no Supabase**

Use `mcp__supabase-cravou__list_tables` e confirme que `posts`, `follows` e `post_curtidas` aparecem na lista.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrations posts, follows, post_curtidas com RLS

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Data layer — `src/lib/feed.ts`

**Files:**
- Create: `src/lib/feed.ts`
- Test: nenhum teste direto — funções de leitura testadas indiretamente; actions testadas na Task 3

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tabelas `posts`, `follows`, `post_curtidas`, `profiles`, `matches`, `predictions`
- Produces:
  - `PostFeed` — tipo do post com autor, jogo, curtidas
  - `PerfilBasico` — `{id: string; apelido: string; avatar_url: string | null}`
  - `MetricasSociais` — `{seguidores: number; seguindo: number}`
  - `PalpiteResumido` — tipo do palpite para a grade
  - `listarPosts(userId: string, offset: number): Promise<PostFeed[]>`
  - `listarPerfis(): Promise<PerfilBasico[]>`
  - `getMetricasSociais(profileId: string): Promise<MetricasSociais>`
  - `getSeguidores(profileId: string): Promise<PerfilBasico[]>`
  - `getSeguindo(profileId: string): Promise<PerfilBasico[]>`
  - `getUltimosPalpites(profileId: string): Promise<PalpiteResumido[]>`
  - `listarJogosParaComposer(): Promise<{id: string; time_casa: string; time_fora: string}[]>`

- [ ] **Step 1: Criar `src/lib/feed.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type PostFeed = {
  id: string;
  user_id: string;
  conteudo: string;
  created_at: string;
  jogo_id: string | null;
  curtidas: number;
  curtido_por_mim: boolean;
  autor: {
    apelido: string;
    avatar_url: string | null;
  };
  jogo: {
    time_casa: string;
    time_fora: string;
    bandeira_casa: string | null;
    bandeira_fora: string | null;
  } | null;
};

export type PerfilBasico = {
  id: string;
  apelido: string;
  avatar_url: string | null;
};

export type MetricasSociais = {
  seguidores: number;
  seguindo: number;
};

export type PalpiteResumido = {
  jogo_id: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  palpite_casa: number;
  palpite_fora: number;
  placar_casa: number | null;
  placar_fora: number | null;
  status: "agendado" | "ao_vivo" | "finalizado";
  pontos: number | null;
};

const POST_LIMIT = 20;

export async function listarPosts(
  userId: string,
  offset: number = 0
): Promise<PostFeed[]> {
  try {
    const supabase = await createClient();

    const { data: rows } = await supabase
      .from("posts")
      .select(
        "id, user_id, conteudo, created_at, jogo_id, " +
          "autor:profiles!posts_user_id_fkey(apelido, avatar_url), " +
          "jogo:matches(time_casa, time_fora, bandeira_casa, bandeira_fora)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + POST_LIMIT - 1);

    if (!rows || rows.length === 0) return [];

    const postIds = rows.map((r) => r.id as string);

    const { data: curtidas } = await supabase
      .from("post_curtidas")
      .select("post_id, user_id")
      .in("post_id", postIds);

    const curtidasMap = new Map<string, { count: number; minha: boolean }>();
    for (const c of curtidas ?? []) {
      const entry = curtidasMap.get(c.post_id) ?? { count: 0, minha: false };
      entry.count++;
      if (c.user_id === userId) entry.minha = true;
      curtidasMap.set(c.post_id, entry);
    }

    return rows.map((r) => {
      const c = curtidasMap.get(r.id as string) ?? { count: 0, minha: false };
      const autorRaw = r.autor as { apelido: string | null; avatar_url: string | null } | null;
      return {
        id: r.id as string,
        user_id: r.user_id as string,
        conteudo: r.conteudo as string,
        created_at: r.created_at as string,
        jogo_id: r.jogo_id as string | null,
        curtidas: c.count,
        curtido_por_mim: c.minha,
        autor: {
          apelido: autorRaw?.apelido ?? "Usuário",
          avatar_url: autorRaw?.avatar_url ?? null,
        },
        jogo: r.jogo as PostFeed["jogo"],
      };
    });
  } catch {
    return [];
  }
}

export async function listarPerfis(): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, apelido, avatar_url")
      .not("apelido", "is", null);
    return (data as PerfilBasico[]) ?? [];
  } catch {
    return [];
  }
}

export async function getMetricasSociais(
  profileId: string
): Promise<MetricasSociais> {
  try {
    const supabase = await createClient();
    const [{ count: seguidores }, { count: seguindo }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId),
    ]);
    return { seguidores: seguidores ?? 0, seguindo: seguindo ?? 0 };
  } catch {
    return { seguidores: 0, seguindo: 0 };
  }
}

export async function getSeguidores(profileId: string): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower:profiles!follows_follower_id_fkey(id, apelido, avatar_url)")
      .eq("following_id", profileId);
    return (data ?? []).map((r) => r.follower as PerfilBasico);
  } catch {
    return [];
  }
}

export async function getSeguindo(profileId: string): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("following:profiles!follows_following_id_fkey(id, apelido, avatar_url)")
      .eq("follower_id", profileId);
    return (data ?? []).map((r) => r.following as PerfilBasico);
  } catch {
    return [];
  }
}

export async function getUltimosPalpites(
  profileId: string
): Promise<PalpiteResumido[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("predictions")
      .select(
        "palpite_casa, palpite_fora, pontos, " +
          "match:matches!predictions_match_id_fkey(" +
          "id, time_casa, time_fora, bandeira_casa, bandeira_fora, " +
          "placar_casa, placar_fora, status" +
          ")"
      )
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);

    return (data ?? []).map((r) => {
      const m = r.match as {
        id: string;
        time_casa: string;
        time_fora: string;
        bandeira_casa: string | null;
        bandeira_fora: string | null;
        placar_casa: number | null;
        placar_fora: number | null;
        status: "agendado" | "ao_vivo" | "finalizado";
      };
      return {
        jogo_id: m.id,
        time_casa: m.time_casa,
        time_fora: m.time_fora,
        bandeira_casa: m.bandeira_casa,
        bandeira_fora: m.bandeira_fora,
        palpite_casa: r.palpite_casa as number,
        palpite_fora: r.palpite_fora as number,
        placar_casa: m.placar_casa,
        placar_fora: m.placar_fora,
        status: m.status,
        pontos: r.pontos as number | null,
      };
    });
  } catch {
    return [];
  }
}

export async function listarJogosParaComposer(): Promise<
  { id: string; time_casa: string; time_fora: string }[]
> {
  try {
    const supabase = await createClient();
    const limite = new Date();
    limite.setDate(limite.getDate() - 3);
    const { data } = await supabase
      .from("matches")
      .select("id, time_casa, time_fora")
      .gte("inicio_em", limite.toISOString())
      .order("inicio_em", { ascending: true })
      .limit(30);
    return (data ?? []) as { id: string; time_casa: string; time_fora: string }[];
  } catch {
    return [];
  }
}

export async function isSeguindo(
  followerId: string,
  followingId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados a `src/lib/feed.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/feed.ts
git commit -m "feat: data layer feed — tipos e queries de leitura

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Server Actions — `src/app/feed/actions.ts`

**Files:**
- Create: `src/app/feed/actions.ts`
- Create: `src/app/feed/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `createClient`, `listarPosts` de `lib/feed.ts`
- Produces:
  - `publicarPost(conteudo: string, jogoId?: string): Promise<{erro?: string}>`
  - `alternarCurtida(postId: string): Promise<void>`
  - `alternarFollow(followingId: string): Promise<void>`
  - `deletarPost(postId: string): Promise<{erro?: string}>`
  - `carregarMaisPosts(offset: number): Promise<PostFeed[]>`

- [ ] **Step 1: Escrever testes primeiro**

Crie `src/app/feed/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  upsert: mockUpsert,
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from: mockFrom,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("publicarPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro para conteúdo vazio", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("  ");
    expect(result.erro).toBeTruthy();
  });

  it("retorna erro para conteúdo > 140 chars", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("x".repeat(141));
    expect(result.erro).toBeTruthy();
  });

  it("insere post válido", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("Vamos Brasil!");
    expect(result.erro).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ conteudo: "Vamos Brasil!" })
    );
  });
});

describe("deletarPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita deletar post de outro usuário", async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: "outro-user" }, error: null });
    const { deletarPost } = await import("../actions");
    const result = await deletarPost("post-1");
    expect(result.erro).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
npx vitest run src/app/feed/__tests__/actions.test.ts
```

Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Criar `src/app/feed/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarPosts, type PostFeed } from "@/lib/feed";

export async function publicarPost(
  conteudo: string,
  jogoId?: string
): Promise<{ erro?: string }> {
  const texto = conteudo.trim();
  if (!texto) return { erro: "O post não pode estar vazio." };
  if (texto.length > 140) return { erro: "Máximo de 140 caracteres." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    conteudo: texto,
    jogo_id: jogoId ?? null,
  });

  if (error) return { erro: "Não foi possível publicar. Tente novamente." };

  revalidatePath("/feed");
  return {};
}

export async function alternarCurtida(postId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existe } = await supabase
    .from("post_curtidas")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existe) {
    await supabase
      .from("post_curtidas")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("post_curtidas")
      .insert({ post_id: postId, user_id: user.id });
  }
}

export async function alternarFollow(followingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === followingId) return;

  const { data: existe } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .single();

  if (existe) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: followingId });
  }

  revalidatePath(`/perfil/${followingId}`);
}

export async function deletarPost(
  postId: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado." };

  const { data: post } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post || post.user_id !== user.id) {
    return { erro: "Você não pode deletar este post." };
  }

  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath("/feed");
  return {};
}

export async function carregarMaisPosts(
  offset: number,
  userId: string
): Promise<PostFeed[]> {
  return listarPosts(userId, offset);
}
```

- [ ] **Step 4: Rodar testes e ver passar**

```bash
npx vitest run src/app/feed/__tests__/actions.test.ts
```

Esperado: PASS (todos os testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/feed/actions.ts src/app/feed/__tests__/actions.test.ts
git commit -m "feat: server actions do feed (publicar, curtir, seguir, deletar)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: MencaoLink

**Files:**
- Create: `src/components/feed/mencao-link.tsx`
- Create: `src/components/feed/__tests__/mencao-link.test.tsx`

**Interfaces:**
- Consumes: nada externo
- Produces:
  - `parseMencoes(conteudo: string, perfis: Record<string, string>): MencaoPart[]`
  - `MencaoPart = {tipo: "texto" | "mencao"; valor: string; userId?: string}`
  - `<MencaoLink conteudo={string} perfis={Record<string, string>} />`

- [ ] **Step 1: Escrever testes**

Crie `src/components/feed/__tests__/mencao-link.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { parseMencoes } from "../mencao-link";

describe("parseMencoes", () => {
  const perfis = { Thiago: "uid-1", Ana: "uid-2" };

  it("retorna texto puro sem menções", () => {
    const result = parseMencoes("Vamos Brasil!", perfis);
    expect(result).toEqual([{ tipo: "texto", valor: "Vamos Brasil!" }]);
  });

  it("parseia @apelido conhecido como menção", () => {
    const result = parseMencoes("Ei @Thiago olha isso", perfis);
    expect(result).toEqual([
      { tipo: "texto", valor: "Ei " },
      { tipo: "mencao", valor: "@Thiago", userId: "uid-1" },
      { tipo: "texto", valor: " olha isso" },
    ]);
  });

  it("mantém @desconhecido como texto", () => {
    const result = parseMencoes("@Ninguem aqui", perfis);
    expect(result).toEqual([
      { tipo: "texto", valor: "@Ninguem" },
      { tipo: "texto", valor: " aqui" },
    ]);
  });

  it("parseia múltiplas menções", () => {
    const result = parseMencoes("@Thiago e @Ana", perfis);
    const mencoes = result.filter((p) => p.tipo === "mencao");
    expect(mencoes).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/feed/__tests__/mencao-link.test.tsx
```

Esperado: FAIL.

- [ ] **Step 3: Criar `src/components/feed/mencao-link.tsx`**

```typescript
import Link from "next/link";

export type MencaoPart = {
  tipo: "texto" | "mencao";
  valor: string;
  userId?: string;
};

export function parseMencoes(
  conteudo: string,
  perfis: Record<string, string>
): MencaoPart[] {
  const partes = conteudo.split(/(@\w+)/g);
  return partes
    .filter((p) => p.length > 0)
    .map((p): MencaoPart => {
      if (p.startsWith("@")) {
        const apelido = p.slice(1);
        const userId = perfis[apelido];
        if (userId) return { tipo: "mencao", valor: p, userId };
      }
      return { tipo: "texto", valor: p };
    });
}

type MencaoLinkProps = {
  conteudo: string;
  perfis: Record<string, string>;
};

export function MencaoLink({ conteudo, perfis }: MencaoLinkProps) {
  const partes = parseMencoes(conteudo, perfis);
  return (
    <>
      {partes.map((parte, i) =>
        parte.tipo === "mencao" && parte.userId ? (
          <Link
            key={i}
            href={`/perfil/${parte.userId}`}
            className="font-semibold text-primary hover:underline"
          >
            {parte.valor}
          </Link>
        ) : (
          <span key={i}>{parte.valor}</span>
        )
      )}
    </>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/components/feed/__tests__/mencao-link.test.tsx
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/mencao-link.tsx src/components/feed/__tests__/mencao-link.test.tsx
git commit -m "feat: MencaoLink — parseia @apelido em texto como links React

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: PostCard

**Files:**
- Create: `src/components/feed/post-card.tsx`
- Create: `src/components/feed/__tests__/post-card.test.tsx`

**Interfaces:**
- Consumes: `PostFeed` de `lib/feed.ts`; `MencaoLink` de `mencao-link.tsx`; `alternarCurtida`, `deletarPost` de `app/feed/actions.ts`
- Produces: `<PostCard post={PostFeed} perfisMap={Record<string,string>} userId={string} />`

- [ ] **Step 1: Escrever testes**

Crie `src/components/feed/__tests__/post-card.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostCard } from "../post-card";
import type { PostFeed } from "@/lib/feed";

vi.mock("@/app/feed/actions", () => ({
  alternarCurtida: vi.fn().mockResolvedValue(undefined),
  deletarPost: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const post: PostFeed = {
  id: "post-1",
  user_id: "user-1",
  conteudo: "Vamos Brasil!",
  created_at: new Date().toISOString(),
  jogo_id: null,
  curtidas: 3,
  curtido_por_mim: false,
  autor: { apelido: "Thiago", avatar_url: null },
  jogo: null,
};

describe("PostCard", () => {
  it("exibe conteúdo do post", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("Vamos Brasil!")).toBeTruthy();
  });

  it("exibe apelido do autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("Thiago")).toBeTruthy();
  });

  it("exibe contagem de curtidas", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("não mostra botão deletar para não-autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.queryByRole("button", { name: /deletar/i })).toBeNull();
  });

  it("mostra menu deletar para o autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-1" />);
    expect(screen.getByLabelText(/opções do post/i)).toBeTruthy();
  });

  it("atualiza curtidas otimistamente ao clicar", async () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    const btn = screen.getByRole("button", { name: /curtir/i });
    await userEvent.click(btn);
    expect(screen.getByText("4")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/feed/__tests__/post-card.test.tsx
```

Esperado: FAIL.

- [ ] **Step 3: Criar `src/components/feed/post-card.tsx`**

```typescript
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Heart, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { MencaoLink } from "./mencao-link";
import { alternarCurtida, deletarPost } from "@/app/feed/actions";
import { avatarPadrao } from "@/lib/avatars";
import type { PostFeed } from "@/lib/feed";

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

type PostCardProps = {
  post: PostFeed;
  perfisMap: Record<string, string>;
  userId: string;
};

export function PostCard({ post, perfisMap, userId }: PostCardProps) {
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [curtidoPorMim, setCurtidoPorMim] = useState(post.curtido_por_mim);
  const [menuAberto, setMenuAberto] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ehAutor = post.user_id === userId;

  async function handleCurtida() {
    setCurtidoPorMim((v) => !v);
    setCurtidas((c) => (curtidoPorMim ? c - 1 : c + 1));
    await alternarCurtida(post.id);
  }

  async function handleDeletar() {
    setDeletando(true);
    await deletarPost(post.id);
  }

  const avatarUrl =
    post.autor.avatar_url ?? avatarPadrao(post.user_id);

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Link href={`/perfil/${post.user_id}`} className="shrink-0">
          <img
            src={avatarUrl}
            alt={post.autor.apelido}
            width={36}
            height={36}
            className="rounded-full"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <Link
                href={`/perfil/${post.user_id}`}
                className="font-semibold hover:underline"
              >
                {post.autor.apelido}
              </Link>
              <span className="text-muted-foreground">·</span>
              <time
                dateTime={post.created_at}
                className="text-muted-foreground"
              >
                {tempoRelativo(post.created_at)}
              </time>
            </div>
            {ehAutor && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuAberto((v) => !v)}
                  aria-label="Opções do post"
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
                {menuAberto && (
                  <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-xl border border-border bg-card shadow-lg">
                    <button
                      onClick={handleDeletar}
                      disabled={deletando}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-muted disabled:opacity-50 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {deletando ? "Deletando..." : "Deletar post"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mb-2 break-words text-sm leading-relaxed">
            <MencaoLink conteudo={post.conteudo} perfis={perfisMap} />
          </p>

          {post.jogo && (
            <Link
              href="/jogos"
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {post.jogo.bandeira_casa && (
                <img src={post.jogo.bandeira_casa} alt="" width={14} height={10} />
              )}
              <span>{post.jogo.time_casa} × {post.jogo.time_fora}</span>
              {post.jogo.bandeira_fora && (
                <img src={post.jogo.bandeira_fora} alt="" width={14} height={10} />
              )}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={handleCurtida}
              aria-label="Curtir"
              aria-pressed={curtidoPorMim}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-colors hover:bg-muted ${
                curtidoPorMim ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <Heart
                className="h-4 w-4"
                fill={curtidoPorMim ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span>{curtidas}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/components/feed/__tests__/post-card.test.tsx
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/post-card.tsx src/components/feed/__tests__/post-card.test.tsx
git commit -m "feat: PostCard com curtida otimista e menu deletar

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: PostComposer

**Files:**
- Create: `src/components/feed/post-composer.tsx`

**Interfaces:**
- Consumes: `publicarPost` de `app/feed/actions.ts`
- Produces: `<PostComposer jogos={...} perfis={PerfilBasico[]} />`

- [ ] **Step 1: Criar `src/components/feed/post-composer.tsx`**

```typescript
"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publicarPost } from "@/app/feed/actions";
import type { PerfilBasico } from "@/lib/feed";

type Jogo = { id: string; time_casa: string; time_fora: string };

type PostComposerProps = {
  jogos: Jogo[];
  perfis: PerfilBasico[];
};

export function PostComposer({ jogos, perfis }: PostComposerProps) {
  const [conteudo, setConteudo] = useState("");
  const [jogoId, setJogoId] = useState<string>("");
  const [jogoFiltro, setJogoFiltro] = useState("");
  const [showJogos, setShowJogos] = useState(false);
  const [showMencao, setShowMencao] = useState(false);
  const [filtroMencao, setFiltroMencao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const restantes = 140 - conteudo.length;

  const jogosFiltrados = jogos.filter(
    (j) =>
      jogoFiltro === "" ||
      j.time_casa.toLowerCase().includes(jogoFiltro.toLowerCase()) ||
      j.time_fora.toLowerCase().includes(jogoFiltro.toLowerCase())
  );

  const perfisFiltrados = perfis
    .filter((p) => p.apelido.toLowerCase().startsWith(filtroMencao.toLowerCase()))
    .slice(0, 5);

  const jogoSelecionado = jogos.find((j) => j.id === jogoId);

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setConteudo(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textAntes = val.slice(0, cursorPos);
    const match = textAntes.match(/@(\w*)$/);
    if (match) {
      setFiltroMencao(match[1]);
      setShowMencao(true);
    } else {
      setShowMencao(false);
    }
  }

  function selecionarMencao(apelido: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart ?? conteudo.length;
    const textAntes = conteudo.slice(0, cursorPos);
    const textDepois = conteudo.slice(cursorPos);
    const novo = textAntes.replace(/@\w*$/, `@${apelido} `) + textDepois;
    setConteudo(novo);
    setShowMencao(false);
    textarea.focus();
  }

  function handleSubmit() {
    setErro(null);
    startTransition(async () => {
      const result = await publicarPost(conteudo, jogoId || undefined);
      if (result.erro) {
        setErro(result.erro);
      } else {
        setConteudo("");
        setJogoId("");
        setJogoFiltro("");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={conteudo}
          onChange={handleTextareaChange}
          placeholder="O que você tá achando?"
          maxLength={145}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {showMencao && perfisFiltrados.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-border bg-card shadow-lg">
            {perfisFiltrados.map((p) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionarMencao(p.apelido);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="font-medium">@{p.apelido}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        {!showJogos && !jogoSelecionado && (
          <button
            onClick={() => setShowJogos(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            + Vincular a um jogo
          </button>
        )}

        {jogoSelecionado && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Jogo: {jogoSelecionado.time_casa} × {jogoSelecionado.time_fora}
            </span>
            <button
              onClick={() => { setJogoId(""); setJogoFiltro(""); }}
              className="text-red-500 hover:underline"
            >
              remover
            </button>
          </div>
        )}

        {showJogos && !jogoSelecionado && (
          <div className="mt-2">
            <input
              type="text"
              placeholder="Filtrar por time..."
              value={jogoFiltro}
              onChange={(e) => setJogoFiltro(e.target.value)}
              className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border">
              {jogosFiltrados.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum jogo encontrado.
                </p>
              )}
              {jogosFiltrados.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    setJogoId(j.id);
                    setShowJogos(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  {j.time_casa} × {j.time_fora}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`text-xs font-medium tabular-nums ${
            restantes <= 20 ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          {restantes}
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || conteudo.trim().length === 0 || restantes < 0}
        >
          {isPending ? "Postando..." : "Postar"}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros no arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/post-composer.tsx
git commit -m "feat: PostComposer com contador, seletor de jogo e popover @menção

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: PostList

**Files:**
- Create: `src/components/feed/post-list.tsx`

**Interfaces:**
- Consumes: `PostCard`; `carregarMaisPosts` de `app/feed/actions.ts`; `PostFeed` de `lib/feed.ts`
- Produces: `<PostList postsIniciais={PostFeed[]} perfisMap={Record<string,string>} userId={string} />`

- [ ] **Step 1: Criar `src/components/feed/post-list.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { PostCard } from "./post-card";
import { carregarMaisPosts } from "@/app/feed/actions";
import type { PostFeed } from "@/lib/feed";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

type PostListProps = {
  postsIniciais: PostFeed[];
  perfisMap: Record<string, string>;
  userId: string;
};

export function PostList({ postsIniciais, perfisMap, userId }: PostListProps) {
  const [posts, setPosts] = useState(postsIniciais);
  const [offset, setOffset] = useState(postsIniciais.length);
  const [temMais, setTemMais] = useState(postsIniciais.length === PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  function handleCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisPosts(offset, userId);
      setPosts((prev) => [...prev, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < PAGE_SIZE) setTemMais(false);
    });
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum post ainda. Seja o primeiro a postar!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} perfisMap={perfisMap} userId={userId} />
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

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/post-list.tsx
git commit -m "feat: PostList com paginação via botão carregar mais

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Página `/feed` e SiteHeader

**Files:**
- Create: `src/app/feed/page.tsx`
- Modify: `src/components/site-header.tsx`

**Interfaces:**
- Consumes: `listarPosts`, `listarPerfis`, `listarJogosParaComposer` de `lib/feed.ts`; `getSessao` de `lib/auth/profile.ts`; `PostComposer`, `PostList`

- [ ] **Step 1: Criar `src/app/feed/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarPosts, listarPerfis, listarJogosParaComposer } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostComposer } from "@/components/feed/post-composer";
import { PostList } from "@/components/feed/post-list";

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

- [ ] **Step 2: Adicionar "Feed" ao SiteHeader**

Abra `src/components/site-header.tsx` e adicione o link "Feed" no nav, entre a marca e "Jogos":

```typescript
// Encontre o bloco nav e adicione antes do link Jogos:
<Link
  href="/feed"
  className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
>
  Feed
</Link>
```

O bloco nav completo fica:

```typescript
<nav className="flex items-center gap-0.5 sm:gap-1">
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

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/feed/page.tsx src/components/site-header.tsx
git commit -m "feat: página /feed e link Feed no SiteHeader

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: PalpiteCardCompacto e PalpitesGrid

**Files:**
- Create: `src/components/perfil/palpite-card-compacto.tsx`
- Create: `src/components/perfil/__tests__/palpite-card-compacto.test.tsx`
- Create: `src/components/perfil/palpites-grid.tsx`

**Interfaces:**
- Consumes: `PalpiteResumido` de `lib/feed.ts`; `nomePais` de `lib/i18n/paises.ts`
- Produces:
  - `<PalpiteCardCompacto palpite={PalpiteResumido} />`
  - `<PalpitesGrid palpites={PalpiteResumido[]} />`

- [ ] **Step 1: Escrever testes**

Crie `src/components/perfil/__tests__/palpite-card-compacto.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteCardCompacto } from "../palpite-card-compacto";
import type { PalpiteResumido } from "@/lib/feed";

const base: PalpiteResumido = {
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
};

describe("PalpiteCardCompacto", () => {
  it("exibe badge Aguardando para jogo não encerrado", () => {
    render(<PalpiteCardCompacto palpite={base} />);
    expect(screen.getByText("Aguardando")).toBeTruthy();
  });

  it("exibe badge Exato para placar exato", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/exato/i)).toBeTruthy();
    expect(screen.getByText(/\+10/)).toBeTruthy();
  });

  it("exibe badge Resultado para resultado correto, placar errado", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 3, placar_fora: 0, pontos: 5 }}
      />
    );
    expect(screen.getByText(/resultado/i)).toBeTruthy();
  });

  it("exibe badge Erro para palpite errado", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 0, placar_fora: 2, pontos: 0 }}
      />
    );
    expect(screen.getByText(/erro/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
npx vitest run src/components/perfil/__tests__/palpite-card-compacto.test.tsx
```

Esperado: FAIL.

- [ ] **Step 4: Criar `src/components/perfil/palpite-card-compacto.tsx`**

Primeiro verifique a assinatura exportada de `lib/i18n/paises.ts` (procure por `export function` no arquivo). O padrão é `nomePaisEmPt(nome: string): string`.

```typescript
import { traduzirPais } from "@/lib/i18n/paises";
import type { PalpiteResumido } from "@/lib/feed";

type Badge = "aguardando" | "exato" | "resultado" | "erro";

function calcBadge(p: PalpiteResumido): Badge {
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

type PalpiteCardCompactoProps = { palpite: PalpiteResumido };

export function PalpiteCardCompacto({ palpite: p }: PalpiteCardCompactoProps) {
  const badge = calcBadge(p);
  const casaNome = traduzirPais(p.time_casa);
  const foraNome = traduzirPais(p.time_fora);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex items-center gap-1 min-w-0">
          {p.bandeira_casa && (
            <img src={p.bandeira_casa} alt="" width={14} height={10} className="shrink-0" />
          )}
          <span className="truncate font-medium">{casaNome}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">×</span>
        <div className="flex items-center gap-1 min-w-0 justify-end">
          <span className="truncate font-medium">{foraNome}</span>
          {p.bandeira_fora && (
            <img src={p.bandeira_fora} alt="" width={14} height={10} className="shrink-0" />
          )}
        </div>
      </div>

      <div className="text-center text-sm font-bold tabular-nums">
        {p.palpite_casa} × {p.palpite_fora}
      </div>

      <div className="flex items-center justify-between gap-1">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES[badge]}`}
        >
          {BADGE_LABELS[badge]}
        </span>
        {badge !== "aguardando" && p.pontos !== null && (
          <span className="text-xs font-semibold text-muted-foreground">
            +{p.pontos}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Criar `src/components/perfil/palpites-grid.tsx`**

```typescript
import { PalpiteCardCompacto } from "./palpite-card-compacto";
import type { PalpiteResumido } from "@/lib/feed";

type PalpitesGridProps = { palpites: PalpiteResumido[] };

export function PalpitesGrid({ palpites }: PalpitesGridProps) {
  if (palpites.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum palpite registrado ainda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {palpites.slice(0, 10).map((p) => (
        <PalpiteCardCompacto key={p.jogo_id} palpite={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
npx vitest run src/components/perfil/__tests__/palpite-card-compacto.test.tsx
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/perfil/palpite-card-compacto.tsx src/components/perfil/__tests__/palpite-card-compacto.test.tsx src/components/perfil/palpites-grid.tsx
git commit -m "feat: PalpiteCardCompacto e PalpitesGrid — grade 2x5 no perfil

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: MetricasSociais e FollowersModal

**Files:**
- Create: `src/components/perfil/followers-modal.tsx`
- Create: `src/components/perfil/metricas-sociais.tsx`

**Interfaces:**
- Consumes: `PerfilBasico` de `lib/feed.ts`
- Produces:
  - `<FollowersModal seguidores={PerfilBasico[]} seguindo={PerfilBasico[]} />` (Client)
  - `<MetricasSociais seguidores={number} seguindo={number} listaSeguidores={PerfilBasico[]} listaSeguindo={PerfilBasico[]} />` (Client)

- [ ] **Step 1: Criar `src/components/perfil/followers-modal.tsx`**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { avatarPadrao } from "@/lib/avatars";
import type { PerfilBasico } from "@/lib/feed";

type Aba = "seguidores" | "seguindo";

type FollowersModalProps = {
  seguidores: PerfilBasico[];
  seguindo: PerfilBasico[];
  abaInicial?: Aba;
  onClose: () => void;
};

export function FollowersModal({
  seguidores,
  seguindo,
  abaInicial = "seguidores",
  onClose,
}: FollowersModalProps) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const lista = aba === "seguidores" ? seguidores : seguindo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => setAba("seguidores")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                aba === "seguidores"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Seguidores
            </button>
            <button
              onClick={() => setAba("seguindo")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                aba === "seguindo"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Seguindo
            </button>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum {aba === "seguidores" ? "seguidor" : "seguindo"} ainda.
            </p>
          )}
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/perfil/${p.id}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"
            >
              <img
                src={p.avatar_url ?? avatarPadrao(p.id)}
                alt={p.apelido}
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-sm font-medium">{p.apelido}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/perfil/metricas-sociais.tsx`**

```typescript
"use client";

import { useState } from "react";
import { FollowersModal } from "./followers-modal";
import type { PerfilBasico } from "@/lib/feed";

type Aba = "seguidores" | "seguindo";

type MetricasSociaisProps = {
  seguidores: number;
  seguindo: number;
  listaSeguidores: PerfilBasico[];
  listaSeguindo: PerfilBasico[];
};

export function MetricasSociais({
  seguidores,
  seguindo,
  listaSeguidores,
  listaSeguindo,
}: MetricasSociaisProps) {
  const [modalAberto, setModalAberto] = useState<Aba | null>(null);

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setModalAberto("seguidores")}
          className="font-medium hover:underline"
        >
          <span className="font-bold">{seguidores}</span>{" "}
          <span className="text-muted-foreground">
            {seguidores === 1 ? "seguidor" : "seguidores"}
          </span>
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          onClick={() => setModalAberto("seguindo")}
          className="font-medium hover:underline"
        >
          <span className="font-bold">{seguindo}</span>{" "}
          <span className="text-muted-foreground">seguindo</span>
        </button>
      </div>

      {modalAberto && (
        <FollowersModal
          seguidores={listaSeguidores}
          seguindo={listaSeguindo}
          abaInicial={modalAberto}
          onClose={() => setModalAberto(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/perfil/followers-modal.tsx src/components/perfil/metricas-sociais.tsx
git commit -m "feat: MetricasSociais e FollowersModal — seguidores/seguindo no perfil

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: FollowButton

**Files:**
- Create: `src/components/perfil/follow-button.tsx`

**Interfaces:**
- Consumes: `alternarFollow` de `app/feed/actions.ts`
- Produces: `<FollowButton followingId={string} isSeguindoInicial={boolean} />`

- [ ] **Step 1: Criar `src/components/perfil/follow-button.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarFollow } from "@/app/feed/actions";

type FollowButtonProps = {
  followingId: string;
  isSeguindoInicial: boolean;
};

export function FollowButton({ followingId, isSeguindoInicial }: FollowButtonProps) {
  const [isSeguindo, setIsSeguindo] = useState(isSeguindoInicial);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setIsSeguindo((v) => !v);
    startTransition(async () => {
      await alternarFollow(followingId);
    });
  }

  return (
    <Button
      variant={isSeguindo ? "outline" : "primary"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isSeguindo ? "Deixar de seguir" : "Seguir"}
    </Button>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/perfil/follow-button.tsx
git commit -m "feat: FollowButton — seguir/deixar de seguir com atualização otimista

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Perfil público `/perfil/[id]`

**Files:**
- Create: `src/app/perfil/[id]/page.tsx`

**Interfaces:**
- Consumes: `getSessao`, `getPerfil` de `lib/auth/profile.ts`; `getMetricasSociais`, `getSeguidores`, `getSeguindo`, `getUltimosPalpites`, `isSeguindo`, `listarPerfis` de `lib/feed.ts`; componentes de perfil

- [ ] **Step 1: Adicionar `getSessaoId` a `src/lib/auth/profile.ts`**

Abra `src/lib/auth/profile.ts` e acrescente ao final:

```typescript
export async function getPerfilPublico(id: string): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const sessao = await getSessao();
    if (!sessao) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, apelido, avatar_url, is_admin")
      .eq("id", id)
      .single();

    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Criar `src/app/perfil/[id]/page.tsx`**

```typescript
import { redirect, notFound } from "next/navigation";
import { getSessao, getPerfilPublico } from "@/lib/auth/profile";
import {
  getMetricasSociais,
  getSeguidores,
  getSeguindo,
  getUltimosPalpites,
  isSeguindo as checkIsSeguindo,
} from "@/lib/feed";
import { avatarPadrao } from "@/lib/avatars";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MetricasSociais } from "@/components/perfil/metricas-sociais";
import { PalpitesGrid } from "@/components/perfil/palpites-grid";
import { FollowButton } from "@/components/perfil/follow-button";

type Props = { params: Promise<{ id: string }> };

export default async function PerfilPublicoPage({ params }: Props) {
  const { id } = await params;
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (id === sessao.userId) redirect("/perfil");

  const [perfil, metricas, seguidores, seguindo, palpites, jaSeguindo] =
    await Promise.all([
      getPerfilPublico(id),
      getMetricasSociais(id),
      getSeguidores(id),
      getSeguindo(id),
      getUltimosPalpites(id),
      checkIsSeguindo(sessao.userId, id),
    ]);

  if (!perfil) notFound();

  const avatarUrl = perfil.avatar_url ?? avatarPadrao(perfil.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <img
            src={avatarUrl}
            alt={perfil.apelido ?? ""}
            width={72}
            height={72}
            className="rounded-full border-2 border-border"
          />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
              {perfil.apelido ?? "Usuário"}
            </h1>
            <MetricasSociais
              seguidores={metricas.seguidores}
              seguindo={metricas.seguindo}
              listaSeguidores={seguidores}
              listaSeguindo={seguindo}
            />
            <FollowButton followingId={id} isSeguindoInicial={jaSeguindo} />
          </div>
        </div>

        <section>
          <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-tight">
            Últimos palpites
          </h2>
          <PalpitesGrid palpites={palpites} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/perfil/[id]/page.tsx src/lib/auth/profile.ts
git commit -m "feat: perfil público /perfil/[id] com follow button e grade de palpites

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Atualizar perfil próprio `/perfil`

**Files:**
- Modify: `src/app/perfil/page.tsx`

**Interfaces:**
- Consumes: tudo já existente + `getMetricasSociais`, `getSeguidores`, `getSeguindo`, `getUltimosPalpites` de `lib/feed.ts`; `MetricasSociais`, `PalpitesGrid`

- [ ] **Step 1: Atualizar `src/app/perfil/page.tsx`**

Substituir o arquivo completo por:

```typescript
import { redirect } from "next/navigation";
import { getPerfil, getSessao } from "@/lib/auth/profile";
import {
  getMetricasSociais,
  getSeguidores,
  getSeguindo,
  getUltimosPalpites,
} from "@/lib/feed";
import { avatarPadrao } from "@/lib/avatars";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ApelidoForm } from "@/components/perfil/apelido-form";
import { AvatarForm } from "@/components/perfil/avatar-form";
import { SenhaForm } from "@/components/perfil/senha-form";
import { MetricasSociais } from "@/components/perfil/metricas-sociais";
import { PalpitesGrid } from "@/components/perfil/palpites-grid";

export default async function PerfilPage() {
  const [perfil, sessao] = await Promise.all([getPerfil(), getSessao()]);
  if (!perfil || !sessao) redirect("/entrar");

  const [metricas, seguidores, seguindo, palpites] = await Promise.all([
    getMetricasSociais(perfil.id),
    getSeguidores(perfil.id),
    getSeguindo(perfil.id),
    getUltimosPalpites(perfil.id),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-display text-3xl font-bold uppercase tracking-tight">
          Meu Perfil
        </h1>
        <div className="mb-8">
          <MetricasSociais
            seguidores={metricas.seguidores}
            seguindo={metricas.seguindo}
            listaSeguidores={seguidores}
            listaSeguindo={seguindo}
          />
        </div>
        <div className="flex flex-col gap-6">
          <ApelidoForm apelidoAtual={perfil.apelido ?? ""} />
          <AvatarForm
            avatarAtual={perfil.avatar_url ?? avatarPadrao(perfil.id)}
          />
          <SenhaForm />
        </div>
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-tight">
            Últimos palpites
          </h2>
          <PalpitesGrid palpites={palpites} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Rodar todos os testes**

```bash
npm test
```

Esperado: PASS em todos os testes.

- [ ] **Step 3: Build de produção**

```bash
npm run build
```

Esperado: build sem erros de tipo ou compilação.

- [ ] **Step 4: Commit final**

```bash
git add src/app/perfil/page.tsx
git commit -m "feat: perfil próprio com MetricasSociais e PalpitesGrid

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Checklist de verificação pós-implementação

- [ ] `npm test` passa sem erros
- [ ] `npm run build` sem erros de tipo
- [ ] `/feed` redireciona para `/entrar` sem sessão
- [ ] `/perfil/[id]` redireciona para `/perfil` quando `id === auth.uid()`
- [ ] Posts com > 140 chars são rejeitados na Server Action
- [ ] Curtida é otimista e idempotente
- [ ] Follow/unfollow é otimista
- [ ] Deletar post só funciona para o autor
- [ ] @menções renderizam como links, nunca como HTML cru
- [ ] Grade de palpites exibe badges corretos (Exato / Resultado / Erro / Aguardando)
- [ ] Dark mode funciona em todos os componentes novos
- [ ] Nav do SiteHeader exibe "Feed" quando logado
