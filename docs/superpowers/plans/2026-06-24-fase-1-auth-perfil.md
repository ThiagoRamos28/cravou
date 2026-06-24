# Cravou! — Fase 1: Auth & Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuários se cadastrem e entrem (email+senha e magic link), tenham um perfil (apelido + avatar) e que cada perfil seja protegido por RLS no Supabase.

**Architecture:** Supabase Auth via `@supabase/ssr` com middleware Next.js para refresh de sessão por cookies. Tabela `profiles` (1:1 com `auth.users`) criada por trigger no signup e protegida por RLS. UI em `/entrar` (login/cadastro/magic link via Server Actions) e `/onboarding` (definir apelido + avatar). Header passa a refletir o estado de sessão.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase (Auth + Postgres + RLS), `@supabase/ssr`, zod, Vitest + RTL.

## Global Constraints

- Nome de exibição: **Cravou!** (com ponto de exclamação) — verbatim.
- Idioma da UI: Português do Brasil.
- ⚠️ Next.js 16 tem breaking changes (ver `AGENTS.md`); confirme APIs em `node_modules/next/dist/docs/` quando em dúvida. `cookies()` é assíncrono.
- Segredos nunca no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` vão ao browser. `.env.local` é git-ignored.
- Reusar o design system: `Button`/`buttonVariants()` de `@/components/ui/button`, `Reveal`, tokens (`bg-primary`, `text-accent`, etc.). Tudo deve funcionar em dark E light.
- Ícones via `lucide-react` (sem emojis como ícone). `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1.
- Pontuação/regra de negócio: fora desta fase.
- Commits: um por task; mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Migração — tabela `profiles` + RLS + trigger

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Consumes: projeto Supabase existente (env já configurado).
- Produces: tabela `public.profiles(id uuid pk → auth.users, apelido text, avatar_url text, is_admin bool, created_at timestamptz)`; trigger que cria a linha de perfil no signup; políticas RLS.

- [ ] **Step 1: Escrever a migração**

Create `supabase/migrations/0001_profiles.sql`:

```sql
-- Perfis: 1:1 com auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  apelido text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Leitura: qualquer usuário autenticado vê todos os perfis (necessário p/ ranking)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Inserção: só o próprio usuário (fallback; o normal é via trigger)
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Atualização: só o próprio perfil
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Cria a linha de perfil automaticamente quando um usuário é criado
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Aplicar a migração no Supabase**

Caminho recomendado (sem precisar linkar a CLI): abra o **Supabase Dashboard → SQL Editor**,
cole o conteúdo de `supabase/migrations/0001_profiles.sql` e clique em **Run**.

Alternativa via CLI (se o projeto estiver linkado): `npx supabase db push`.

- [ ] **Step 3: Verificar no banco**

No SQL Editor, rode:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'profiles';

select policyname from pg_policies
where schemaname = 'public' and tablename = 'profiles';
```

Expected: retorna `profiles` e as três políticas (`profiles_select_authenticated`,
`profiles_insert_self`, `profiles_update_self`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat: migracao profiles com RLS e trigger de signup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Schemas de validação (zod) + tipos

**Files:**
- Create: `src/lib/auth/validation.ts`
- Create: `src/lib/auth/__tests__/validation.test.ts`
- Modify: `package.json` (dependência `zod`)

**Interfaces:**
- Consumes: nada do projeto.
- Produces:
  - `credenciaisSchema` (zod) → `{ email: string; senha: string }`
  - `magicLinkSchema` (zod) → `{ email: string }`
  - `perfilSchema` (zod) → `{ apelido: string; avatar_url: string }`
  - `validar<T>(schema, data): { sucesso: true; dados: T } | { sucesso: false; erro: string }`

- [ ] **Step 1: Instalar zod**

```bash
cd "d:/Projetos/Bolao-TI"
npm install zod
```

- [ ] **Step 2: Escrever os testes (falhando)**

Create `src/lib/auth/__tests__/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  credenciaisSchema,
  magicLinkSchema,
  perfilSchema,
  validar,
} from "@/lib/auth/validation";

describe("validar()", () => {
  it("aceita credenciais válidas", () => {
    const r = validar(credenciaisSchema, { email: "a@b.com", senha: "123456" });
    expect(r.sucesso).toBe(true);
  });

  it("rejeita email inválido com mensagem em PT-BR", () => {
    const r = validar(credenciaisSchema, { email: "nao-email", senha: "123456" });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/e-mail/i);
  });

  it("rejeita senha com menos de 6 caracteres", () => {
    const r = validar(credenciaisSchema, { email: "a@b.com", senha: "123" });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/senha/i);
  });

  it("magicLinkSchema exige email válido", () => {
    expect(validar(magicLinkSchema, { email: "a@b.com" }).sucesso).toBe(true);
    expect(validar(magicLinkSchema, { email: "x" }).sucesso).toBe(false);
  });

  it("perfilSchema exige apelido entre 2 e 20 e avatar não vazio", () => {
    expect(
      validar(perfilSchema, { apelido: "Zé", avatar_url: "u" }).sucesso
    ).toBe(true);
    expect(
      validar(perfilSchema, { apelido: "Z", avatar_url: "u" }).sucesso
    ).toBe(false);
    expect(
      validar(perfilSchema, { apelido: "Zé", avatar_url: "" }).sucesso
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- validation`
Expected: FAIL — `@/lib/auth/validation` não existe.

- [ ] **Step 4: Implementar**

Create `src/lib/auth/validation.ts`:

```ts
import { z } from "zod";

export const credenciaisSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

export const magicLinkSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

export const perfilSchema = z.object({
  apelido: z
    .string()
    .trim()
    .min(2, "O apelido deve ter ao menos 2 caracteres.")
    .max(20, "O apelido deve ter no máximo 20 caracteres."),
  avatar_url: z.string().min(1, "Escolha um avatar."),
});

export type Credenciais = z.infer<typeof credenciaisSchema>;
export type MagicLink = z.infer<typeof magicLinkSchema>;
export type Perfil = z.infer<typeof perfilSchema>;

type Resultado<T> =
  | { sucesso: true; dados: T }
  | { sucesso: false; erro: string };

export function validar<T>(schema: z.ZodType<T>, data: unknown): Resultado<T> {
  const r = schema.safeParse(data);
  if (r.success) return { sucesso: true, dados: r.data };
  return { sucesso: false, erro: r.error.issues[0]?.message ?? "Dados inválidos." };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- validation`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: schemas de validacao de auth e perfil (zod)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Middleware de sessão Supabase

**Files:**
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: env vars Supabase.
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>` que renova a sessão por cookies em toda navegação.

- [ ] **Step 1: Implementar o helper de sessão**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: não rode código entre createServerClient e getUser().
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 2: Registrar o middleware**

Create `src/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila sem erros; o output lista `ƒ Middleware`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: middleware de refresh de sessao Supabase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Avatares + helpers de perfil/sessão

**Files:**
- Create: `src/lib/avatars.ts`
- Create: `src/lib/auth/profile.ts`
- Create: `src/lib/__tests__/avatars.test.ts`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/server`.
- Produces:
  - `AVATAR_OPTIONS: string[]` (6 URLs de avatar) e `avatarPadrao(seed: string): string`
  - `type Profile = { id: string; apelido: string | null; avatar_url: string | null; is_admin: boolean }`
  - `getSessao(): Promise<{ userId: string; email: string | null } | null>`
  - `getPerfil(): Promise<Profile | null>` (perfil do usuário logado, ou null se deslogado)

- [ ] **Step 1: Escrever o teste de avatares (falhando)**

Create `src/lib/__tests__/avatars.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AVATAR_OPTIONS, avatarPadrao } from "@/lib/avatars";

describe("avatars", () => {
  it("oferece 6 opções de avatar com URLs http", () => {
    expect(AVATAR_OPTIONS).toHaveLength(6);
    for (const url of AVATAR_OPTIONS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it("avatarPadrao é determinístico para a mesma seed", () => {
    expect(avatarPadrao("ze")).toBe(avatarPadrao("ze"));
    expect(avatarPadrao("ze")).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- avatars`
Expected: FAIL — `@/lib/avatars` não existe.

- [ ] **Step 3: Implementar avatares**

Create `src/lib/avatars.ts`:

```ts
// Avatares gerados por URL (DiceBear) — sem upload/armazenamento.
const BASE = "https://api.dicebear.com/9.x/fun-emoji/svg?seed=";

const SEEDS = ["gol", "craque", "artilheiro", "zaga", "goleiro", "torcida"];

export const AVATAR_OPTIONS: string[] = SEEDS.map(
  (s) => `${BASE}${encodeURIComponent(s)}`
);

export function avatarPadrao(seed: string): string {
  return `${BASE}${encodeURIComponent(seed || "torcida")}`;
}
```

- [ ] **Step 4: Implementar helpers de perfil/sessão**

Create `src/lib/auth/profile.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  apelido: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

export async function getSessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

export async function getPerfil(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, apelido, avatar_url, is_admin")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- avatars`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: opcoes de avatar e helpers de perfil/sessao

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Rota de callback de auth + sign out

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/sair/route.ts`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/server`.
- Produces: `GET /auth/callback` (troca o code do magic link/confirmação por sessão e redireciona) e `POST /auth/sair` (encerra sessão e redireciona para `/`).

- [ ] **Step 1: Implementar o callback**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link`);
}
```

- [ ] **Step 2: Implementar o sign out**

Create `src/app/auth/sair/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila; rotas `/auth/callback` e `/auth/sair` aparecem no output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: rota de callback de auth e sign out

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Página `/entrar` (login, cadastro, magic link)

**Files:**
- Create: `src/app/entrar/actions.ts`
- Create: `src/app/entrar/page.tsx`
- Create: `src/components/auth/auth-form.tsx`
- Create: `src/components/auth/__tests__/auth-form.test.tsx`

**Interfaces:**
- Consumes: `credenciaisSchema`, `magicLinkSchema`, `validar` (Task 2); `createClient` server; `getSessao` (Task 4); `buttonVariants`/`Button`.
- Produces:
  - Server actions: `entrarComSenha(_prev, formData): Promise<{ erro?: string }>`,
    `cadastrar(_prev, formData): Promise<{ erro?: string }>`,
    `enviarMagicLink(_prev, formData): Promise<{ erro?: string; ok?: string }>`
  - `<AuthForm />` (client) com abas "Entrar", "Criar conta" e "Link mágico".

- [ ] **Step 1: Implementar as server actions**

Create `src/app/entrar/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  credenciaisSchema,
  magicLinkSchema,
  validar,
} from "@/lib/auth/validation";

type EstadoAuth = { erro?: string; ok?: string };

export async function entrarComSenha(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(credenciaisSchema, {
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: v.dados.email,
    password: v.dados.senha,
  });
  if (error) return { erro: "E-mail ou senha incorretos." };

  redirect("/onboarding");
}

export async function cadastrar(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(credenciaisSchema, {
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: v.dados.email,
    password: v.dados.senha,
  });
  if (error) return { erro: "Não foi possível criar a conta. Tente outro e-mail." };

  redirect("/onboarding");
}

export async function enviarMagicLink(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(magicLinkSchema, { email: formData.get("email") });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: v.dados.email,
    options: { emailRedirectTo: undefined },
  });
  if (error) return { erro: "Não foi possível enviar o link. Tente novamente." };

  return { ok: "Enviamos um link de acesso para o seu e-mail." };
}
```

- [ ] **Step 2: Escrever o teste do AuthForm (falhando)**

Create `src/components/auth/__tests__/auth-form.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/components/auth/auth-form";

describe("AuthForm", () => {
  it("começa na aba Entrar com campos de e-mail e senha", () => {
    render(<AuthForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it("na aba Link mágico esconde o campo de senha", async () => {
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("tab", { name: /link mágico/i }));
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- auth-form`
Expected: FAIL — `@/components/auth/auth-form` não existe.

- [ ] **Step 4: Implementar o AuthForm**

Create `src/components/auth/auth-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  entrarComSenha,
  cadastrar,
  enviarMagicLink,
} from "@/app/entrar/actions";

type Aba = "entrar" | "criar" | "magico";

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
  const acao =
    aba === "entrar" ? entrarComSenha : aba === "criar" ? cadastrar : enviarMagicLink;
  const [estado, formAction] = useActionState(acao, {} as { erro?: string; ok?: string });

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
```

- [ ] **Step 5: Implementar a página `/entrar`**

Create `src/app/entrar/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessao } from "@/lib/auth/profile";

export default async function EntrarPage() {
  const sessao = await getSessao();
  if (sessao) redirect("/onboarding");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-foreground">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-display text-2xl font-bold uppercase tracking-tight">
          Cravou!
        </span>
      </Link>
      <AuthForm />
    </main>
  );
}
```

- [ ] **Step 6: Rodar testes e build**

Run: `npm test -- auth-form && npm run build`
Expected: testes PASS; build compila.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: pagina /entrar com login, cadastro e magic link

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Página `/onboarding` (apelido + avatar)

**Files:**
- Create: `src/app/onboarding/actions.ts`
- Create: `src/app/onboarding/page.tsx`
- Create: `src/components/auth/onboarding-form.tsx`
- Create: `src/components/auth/__tests__/onboarding-form.test.tsx`

**Interfaces:**
- Consumes: `perfilSchema`, `validar` (Task 2); `AVATAR_OPTIONS` (Task 4); `getPerfil`/`getSessao` (Task 4); `createClient` server; `Button`.
- Produces: server action `salvarPerfil(_prev, formData): Promise<{ erro?: string }>` (atualiza `profiles` e redireciona para `/`); `<OnboardingForm avatares={string[]} apelidoInicial={string} avatarInicial={string} />` (client).

- [ ] **Step 1: Implementar a server action**

Create `src/app/onboarding/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilSchema, validar } from "@/lib/auth/validation";

export async function salvarPerfil(
  _prev: { erro?: string },
  formData: FormData
): Promise<{ erro?: string }> {
  const v = validar(perfilSchema, {
    apelido: formData.get("apelido"),
    avatar_url: formData.get("avatar_url"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ apelido: v.dados.apelido, avatar_url: v.dados.avatar_url })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  redirect("/");
}
```

- [ ] **Step 2: Escrever o teste do OnboardingForm (falhando)**

Create `src/components/auth/__tests__/onboarding-form.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "@/components/auth/onboarding-form";

const avatares = ["https://x/1", "https://x/2", "https://x/3"];

describe("OnboardingForm", () => {
  it("mostra campo de apelido e as opções de avatar", () => {
    render(
      <OnboardingForm avatares={avatares} apelidoInicial="" avatarInicial={avatares[0]} />
    );
    expect(screen.getByLabelText(/apelido/i)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("seleciona um avatar ao clicar", async () => {
    render(
      <OnboardingForm avatares={avatares} apelidoInicial="" avatarInicial={avatares[0]} />
    );
    const opcoes = screen.getAllByRole("radio");
    await userEvent.click(opcoes[1]);
    expect(opcoes[1]).toBeChecked();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- onboarding-form`
Expected: FAIL — `@/components/auth/onboarding-form` não existe.

- [ ] **Step 4: Implementar o OnboardingForm**

Create `src/components/auth/onboarding-form.tsx`:

```tsx
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
```

- [ ] **Step 5: Implementar a página `/onboarding`**

Create `src/app/onboarding/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth/profile";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");
  if (perfil.apelido) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-foreground">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Quase lá!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Escolha como você vai aparecer no ranking.
        </p>
      </div>
      <OnboardingForm
        avatares={AVATAR_OPTIONS}
        apelidoInicial=""
        avatarInicial={AVATAR_OPTIONS[0]}
      />
    </main>
  );
}
```

- [ ] **Step 6: Rodar testes e build**

Run: `npm test -- onboarding-form && npm run build`
Expected: testes PASS; build compila.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: onboarding de apelido e avatar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Header sensível à sessão

**Files:**
- Modify: `src/components/site-header.tsx`
- Create: `src/components/auth/user-menu.tsx`
- Modify: `src/components/__tests__/site-header.test.tsx`

**Interfaces:**
- Consumes: `getPerfil` (Task 4); `buttonVariants`; `avatarPadrao` (Task 4).
- Produces: header assíncrono (Server Component) que mostra `<UserMenu>` (avatar + apelido + sair) quando logado, ou o link "Entrar" quando deslogado.

- [ ] **Step 1: Atualizar o teste do header (deve continuar passando com a marca)**

O teste atual renderiza `<SiteHeader />` diretamente, mas o header passará a ser `async`.
Modify `src/components/__tests__/site-header.test.tsx` para testar a marca sem a parte
assíncrona, extraindo a marca para um subcomponente síncrono. Substitua o arquivo por:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { HeaderBrand } from "@/components/site-header";

describe("HeaderBrand", () => {
  it("exibe a marca Cravou!", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <HeaderBrand />
      </ThemeProvider>
    );
    expect(screen.getByText("Cravou!")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- site-header`
Expected: FAIL — `HeaderBrand` não é exportado.

- [ ] **Step 3: Implementar o UserMenu**

Create `src/components/auth/user-menu.tsx`:

```tsx
import { LogOut } from "lucide-react";

export function UserMenu({
  apelido,
  avatarUrl,
}: {
  apelido: string;
  avatarUrl: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full bg-muted"
        />
        <span className="hidden text-sm font-medium sm:inline">{apelido}</span>
      </span>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          aria-label="Sair"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Refatorar o SiteHeader (marca síncrona + header assíncrono)**

Replace `src/components/site-header.tsx`:

```tsx
import Link from "next/link";
import { Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { getPerfil } from "@/lib/auth/profile";
import { avatarPadrao } from "@/lib/avatars";

export function HeaderBrand() {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90">
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
        Cravou!
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  const perfil = await getPerfil();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderBrand />
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {perfil ? (
            <UserMenu
              apelido={perfil.apelido ?? "Você"}
              avatarUrl={perfil.avatar_url ?? avatarPadrao(perfil.id)}
            />
          ) : (
            <Link href="/entrar" className={buttonVariants("primary", "sm")}>
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Rodar testes e build**

Run: `npm test && npm run build`
Expected: todos os testes PASS; build compila. (A home usa `<SiteHeader />`, agora async —
Server Components podem ser async no App Router.)

- [ ] **Step 6: Verificação manual do fluxo completo**

Run: `npm run dev`, e em `http://localhost:3000`:
1. Clicar em "Entrar" → criar conta com e-mail+senha → cair no `/onboarding`.
2. Definir apelido + avatar → cair na home com o header mostrando avatar+apelido.
3. Clicar em "Sair" → header volta a mostrar "Entrar".
4. Conferir em dark E light.

Expected: fluxo funciona; sem erros no console (exceto o aviso conhecido do next-themes).
Encerre o dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: header sensivel a sessao com menu de usuario e sair

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Configuração no Supabase (necessária para o fluxo funcionar)

Estes passos são feitos pelo usuário no **Supabase Dashboard** (não há código):

1. **Authentication → URL Configuration:** em *Redirect URLs*, adicione
   `http://localhost:3000/auth/callback` e `https://cravou-iota.vercel.app/auth/callback`.
   Em *Site URL*, use `https://cravou-iota.vercel.app`.
2. **Authentication → Providers → Email:** garanta que *Email* está habilitado. Para um grupo
   fechado, pode-se **desabilitar "Confirm email"** (Authentication → Providers → Email →
   "Confirm email" off) para login com senha funcionar sem etapa de confirmação. O magic link
   funciona independentemente.
3. (Opcional) Definir um admin: no SQL Editor, `update public.profiles set is_admin = true where id = '<uuid do usuário>';` (usado a partir da Fase 2).

---

## Self-Review

**Spec coverage (Fase 1):**
- Login/cadastro email+senha e magic link → Tasks 5, 6 (+ callback Task 5).
- Onboarding apelido+avatar → Task 7.
- Tabela `profiles` + RLS → Task 1.
- Sessão por cookies (SSR) → Task 3 (middleware) + `@/lib/supabase/server` (Fase 0).
- Header refletindo sessão / sair → Task 8.

**Placeholder scan:** sem "TBD"/"TODO"; todo passo de código traz o código completo. Validações
concretas (zod) em vez de "adicionar validação".

**Type consistency:** `getPerfil(): Profile | null`, `getSessao()`, `AVATAR_OPTIONS`,
`avatarPadrao`, `validar`/schemas, server actions `(_prev, formData) => Promise<{erro?,ok?}>`
(formato do `useActionState`) usados de forma consistente entre tasks.

**Notas de risco:**
- RLS/auth são integração; testes unitários cobrem validação, avatares e render dos formulários.
  O fluxo ponta-a-ponta é verificado manualmente (Task 8, Step 6) — testes E2E ficam para a Fase 7.
- ⚠️ Next 16: confirmar assinatura de `cookies()`/middleware em `node_modules/next/dist/docs/`
  se o build acusar incompatibilidade; o padrão `@supabase/ssr` aqui é o atual recomendado.
- Avatares usam DiceBear por URL via `<img>` (sem next/image remotePatterns, sem upload/storage).
