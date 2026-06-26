# Perfil do Usuário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/perfil` com três cards independentes (Apelido, Avatar, Senha) e transformar o `UserMenu` em dropdown com link para o perfil.

**Architecture:** Server Component protegido em `/perfil` que carrega o perfil via `getPerfil()` e renderiza três client components, cada um com sua própria Server Action. O `UserMenu` vira `"use client"` com estado local para o dropdown animado com Framer Motion.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (`@supabase/ssr`), Zod, Framer Motion, Tailwind CSS v4, Vitest + React Testing Library.

## Global Constraints

- Idioma da UI: Português do Brasil — todos os textos visíveis ao usuário em pt-BR.
- Ícones: `lucide-react` — nunca emojis como ícones.
- Framer Motion: sempre respeitar `prefers-reduced-motion` via `useReducedMotion()`.
- Componentes com hooks precisam de `"use client"`.
- Segredos nunca no client — Supabase Service Role só em Edge Functions / Server Actions.
- `ease` cubic-bezier no Framer Motion precisa de `as const` (tupla). Strings como `"easeOut"` são aceitas sem `as const`.
- Commits terminam com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- TDD: escreva o teste, veja falhar, implemente, veja passar, commit.
- `framer-motion` é mockado nos testes via alias em `vitest.config.ts` — use normalmente nos componentes.
- Fuso: `America/Sao_Paulo` para exibição. Não aplicável nesta feature (sem datas).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/avatars.ts` | Modificar | Adicionar `ESTILOS_AVATAR`, `avatarUrlFromEstilo`, `estiloDoAvatar` |
| `src/lib/__tests__/avatars.test.ts` | Modificar | Cobrir novas exportações |
| `src/lib/auth/validation.ts` | Modificar | Adicionar `atualizarSenhaSchema` + tipo `AtualizarSenha` |
| `src/lib/auth/__tests__/validation.test.ts` | Modificar | Cobrir `atualizarSenhaSchema` |
| `src/app/perfil/actions.ts` | Criar | Server Actions: `atualizarApelido`, `atualizarAvatar`, `atualizarSenha` |
| `src/app/perfil/page.tsx` | Criar | Server Component protegido — monta os três cards |
| `src/components/perfil/apelido-form.tsx` | Criar | Client component — campo de apelido + submit |
| `src/components/perfil/avatar-form.tsx` | Criar | Client component — abas de estilo + grid + submit |
| `src/components/perfil/senha-form.tsx` | Criar | Client component — três campos de senha + submit |
| `src/components/perfil/__tests__/apelido-form.test.tsx` | Criar | Testes RTL do ApelidoForm |
| `src/components/perfil/__tests__/avatar-form.test.tsx` | Criar | Testes RTL do AvatarForm |
| `src/components/perfil/__tests__/senha-form.test.tsx` | Criar | Testes RTL do SenhaForm |
| `src/components/auth/user-menu.tsx` | Modificar | Virar dropdown com "Editar perfil" + "Sair" |
| `src/components/auth/__tests__/user-menu.test.tsx` | Criar | Testes RTL do UserMenu |

---

## Task 1: Expandir `avatars.ts` com múltiplos estilos

**Files:**
- Modify: `src/lib/avatars.ts`
- Modify: `src/lib/__tests__/avatars.test.ts`

**Interfaces:**
- Produces:
  - `ESTILOS_AVATAR: Record<string, string[]>` — mapa de estilo → array de seeds
  - `avatarUrlFromEstilo(estilo: string, seed: string): string` — gera URL DiceBear
  - `estiloDoAvatar(url: string): string` — extrai estilo de URL DiceBear (fallback `"fun-emoji"`)
  - `AVATAR_OPTIONS: string[]` — mantido, gerado a partir do `fun-emoji` (backward compat)
  - `avatarPadrao(seed: string): string` — mantido sem alteração

- [ ] **Step 1: Escrever os testes que devem falhar**

Substitua TODO o conteúdo de `src/lib/__tests__/avatars.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AVATAR_OPTIONS,
  ESTILOS_AVATAR,
  avatarPadrao,
  avatarUrlFromEstilo,
  estiloDoAvatar,
} from "@/lib/avatars";

describe("AVATAR_OPTIONS", () => {
  it("oferece 6 opções com URLs http (compat onboarding)", () => {
    expect(AVATAR_OPTIONS).toHaveLength(6);
    for (const url of AVATAR_OPTIONS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

describe("avatarPadrao", () => {
  it("é determinístico para a mesma seed", () => {
    expect(avatarPadrao("ze")).toBe(avatarPadrao("ze"));
    expect(avatarPadrao("ze")).toMatch(/^https?:\/\//);
  });
});

describe("ESTILOS_AVATAR", () => {
  it("contém exatamente 5 estilos", () => {
    expect(Object.keys(ESTILOS_AVATAR)).toHaveLength(5);
  });

  it("cada estilo tem 6 seeds", () => {
    for (const seeds of Object.values(ESTILOS_AVATAR)) {
      expect(seeds).toHaveLength(6);
    }
  });

  it("inclui fun-emoji, adventurer, bottts, pixel-art e lorelei", () => {
    expect(ESTILOS_AVATAR).toHaveProperty("fun-emoji");
    expect(ESTILOS_AVATAR).toHaveProperty("adventurer");
    expect(ESTILOS_AVATAR).toHaveProperty("bottts");
    expect(ESTILOS_AVATAR).toHaveProperty("pixel-art");
    expect(ESTILOS_AVATAR).toHaveProperty("lorelei");
  });
});

describe("avatarUrlFromEstilo", () => {
  it("gera URL DiceBear válida para estilo e seed", () => {
    const url = avatarUrlFromEstilo("fun-emoji", "gol");
    expect(url).toBe(
      "https://api.dicebear.com/9.x/fun-emoji/svg?seed=gol"
    );
  });

  it("codifica seeds com caracteres especiais", () => {
    const url = avatarUrlFromEstilo("lorelei", "repórter");
    expect(url).toContain("dicebear.com/9.x/lorelei/svg?seed=");
    expect(url).toContain(encodeURIComponent("repórter"));
  });
});

describe("estiloDoAvatar", () => {
  it("extrai o estilo de uma URL DiceBear 9.x válida", () => {
    const url = "https://api.dicebear.com/9.x/pixel-art/svg?seed=abc";
    expect(estiloDoAvatar(url)).toBe("pixel-art");
  });

  it("retorna fun-emoji para URL desconhecida", () => {
    expect(estiloDoAvatar("https://example.com/foto.png")).toBe("fun-emoji");
  });

  it("retorna fun-emoji para string vazia", () => {
    expect(estiloDoAvatar("")).toBe("fun-emoji");
  });

  it("retorna fun-emoji para estilo fora do mapa", () => {
    const url = "https://api.dicebear.com/9.x/estilo-desconhecido/svg?seed=x";
    expect(estiloDoAvatar(url)).toBe("fun-emoji");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- avatars
```

Esperado: `ESTILOS_AVATAR`, `avatarUrlFromEstilo`, `estiloDoAvatar` não existem → FAIL.

- [ ] **Step 3: Implementar as novas exportações em `avatars.ts`**

Substitua TODO o conteúdo de `src/lib/avatars.ts`:

```ts
const BASE = "https://api.dicebear.com/9.x/";

export const ESTILOS_AVATAR: Record<string, string[]> = {
  "fun-emoji":  ["gol", "craque", "artilheiro", "zaga", "goleiro", "torcida"],
  "adventurer": ["camisa10", "meiocampo", "lateral", "zagueiro", "atacante", "reserva"],
  "bottts":     ["robo-gol", "robo-passe", "robo-chute", "robo-falta", "robo-escanteio", "robo-impedimento"],
  "pixel-art":  ["pixel-verde", "pixel-laranja", "pixel-azul", "pixel-branco", "pixel-amarelo", "pixel-vermelho"],
  "lorelei":    ["torcedora", "tecnica", "arbitro", "mascote", "comentarista", "repórter"],
};

export function avatarUrlFromEstilo(estilo: string, seed: string): string {
  return `${BASE}${estilo}/svg?seed=${encodeURIComponent(seed)}`;
}

export function estiloDoAvatar(url: string): string {
  const match = url.match(/dicebear\.com\/9\.x\/([^/]+)\/svg/);
  const estilo = match?.[1] ?? "fun-emoji";
  return estilo in ESTILOS_AVATAR ? estilo : "fun-emoji";
}

export const AVATAR_OPTIONS: string[] = (ESTILOS_AVATAR["fun-emoji"] ?? []).map(
  (seed) => avatarUrlFromEstilo("fun-emoji", seed)
);

export function avatarPadrao(seed: string): string {
  return avatarUrlFromEstilo("fun-emoji", seed || "torcida");
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- avatars
```

Esperado: todos os testes passam (PASS).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatars.ts src/lib/__tests__/avatars.test.ts
git commit -m "feat: expandir avatars com múltiplos estilos DiceBear

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Adicionar `atualizarSenhaSchema` à validação

**Files:**
- Modify: `src/lib/auth/validation.ts`
- Modify: `src/lib/auth/__tests__/validation.test.ts`

**Interfaces:**
- Consumes: `z` de `zod` (já importado no arquivo)
- Produces:
  - `atualizarSenhaSchema` — ZodEffects com refine (senhas iguais)
  - `AtualizarSenha` — `z.infer<typeof atualizarSenhaSchema>` com campos `senha_atual`, `senha_nova`, `confirmar`

- [ ] **Step 1: Escrever os testes**

Em `src/lib/auth/__tests__/validation.test.ts`:
1. Adicione `atualizarSenhaSchema` ao import existente no topo do arquivo:
   ```ts
   import {
     credenciaisSchema,
     magicLinkSchema,
     perfilSchema,
     atualizarSenhaSchema,
     validar,
   } from "@/lib/auth/validation";
   ```
2. Adicione o novo `describe` ao **final** do arquivo (após o `describe` de `validar()` existente):

```ts
describe("atualizarSenhaSchema", () => {
  it("aceita dados válidos com senhas iguais", () => {
    const r = validar(atualizarSenhaSchema, {
      senha_atual: "senhavelha",
      senha_nova: "senhanova123",
      confirmar: "senhanova123",
    });
    expect(r.sucesso).toBe(true);
  });

  it("rejeita quando senha_nova tem menos de 6 caracteres", () => {
    const r = validar(atualizarSenhaSchema, {
      senha_atual: "senhavelha",
      senha_nova: "abc",
      confirmar: "abc",
    });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/6 caracteres/i);
  });

  it("rejeita quando senhas não coincidem", () => {
    const r = validar(atualizarSenhaSchema, {
      senha_atual: "senhavelha",
      senha_nova: "senhanova123",
      confirmar: "diferente123",
    });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/não coincidem/i);
  });

  it("rejeita quando senha_atual está vazia", () => {
    const r = validar(atualizarSenhaSchema, {
      senha_atual: "",
      senha_nova: "senhanova123",
      confirmar: "senhanova123",
    });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/senha atual/i);
  });
});
```

**Atenção:** O arquivo de teste importa do mesmo módulo. Ajuste o import no topo do arquivo para incluir `atualizarSenhaSchema`.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- validation
```

Esperado: `atualizarSenhaSchema` não exportado → FAIL.

- [ ] **Step 3: Implementar o schema em `validation.ts`**

Adicione ao final de `src/lib/auth/validation.ts` (após as exportações existentes):

```ts
export const atualizarSenhaSchema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual."),
    senha_nova: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
    confirmar: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.senha_nova === d.confirmar, {
    message: "As senhas não coincidem.",
    path: ["confirmar"],
  });

export type AtualizarSenha = z.infer<typeof atualizarSenhaSchema>;
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- validation
```

Esperado: todos os testes passam (PASS).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/validation.ts src/lib/auth/__tests__/validation.test.ts
git commit -m "feat: adicionar atualizarSenhaSchema à validação

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Server Actions da página de perfil

**Files:**
- Create: `src/app/perfil/actions.ts`

**Interfaces:**
- Consumes:
  - `createClient` de `@/lib/supabase/server`
  - `perfilSchema` de `@/lib/auth/validation` — via `.pick()`
  - `atualizarSenhaSchema` de `@/lib/auth/validation`
  - `validar` de `@/lib/auth/validation`
  - `revalidatePath` de `next/cache`
  - `redirect` de `next/navigation`
- Produces:
  - `atualizarApelido(_prev: EstadoPerfil, formData: FormData): Promise<EstadoPerfil>`
  - `atualizarAvatar(_prev: EstadoPerfil, formData: FormData): Promise<EstadoPerfil>`
  - `atualizarSenha(_prev: EstadoPerfil, formData: FormData): Promise<EstadoPerfil>`
  - onde `EstadoPerfil = { sucesso?: boolean; erro?: string }`

*Nota:* Server Actions com Supabase seguem o mesmo padrão de `src/app/onboarding/actions.ts` (sem testes unitários neste projeto — a lógica de validação é coberta pelos testes da Task 2).

- [ ] **Step 1: Criar o arquivo de actions**

Crie `src/app/perfil/actions.ts` com o seguinte conteúdo:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilSchema, atualizarSenhaSchema, validar } from "@/lib/auth/validation";

export type EstadoPerfil = { sucesso?: boolean; erro?: string };

export async function atualizarApelido(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(perfilSchema.pick({ apelido: true }), {
    apelido: formData.get("apelido"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ apelido: v.dados.apelido })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/perfil");
  return { sucesso: true };
}

export async function atualizarAvatar(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(perfilSchema.pick({ avatar_url: true }), {
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
    .update({ avatar_url: v.dados.avatar_url })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/perfil");
  return { sucesso: true };
}

export async function atualizarSenha(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(atualizarSenhaSchema, {
    senha_atual: formData.get("senha_atual"),
    senha_nova: formData.get("senha_nova"),
    confirmar: formData.get("confirmar"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: v.dados.senha_atual,
  });
  if (authError) return { erro: "Senha atual incorreta." };

  const { error: updateError } = await supabase.auth.updateUser({
    password: v.dados.senha_nova,
  });
  if (updateError) return { erro: "Não foi possível alterar a senha. Tente novamente." };

  return { sucesso: true };
}
```

- [ ] **Step 2: Verificar que o build TypeScript não tem erros**

```bash
npm run build 2>&1 | head -30
```

Esperado: sem erros de tipo nas novas linhas (pode haver erros de outros arquivos se a página ainda não existir — normal).

- [ ] **Step 3: Commit**

```bash
git add src/app/perfil/actions.ts
git commit -m "feat: server actions de perfil (apelido, avatar, senha)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `ApelidoForm` — componente e testes

**Files:**
- Create: `src/components/perfil/apelido-form.tsx`
- Create: `src/components/perfil/__tests__/apelido-form.test.tsx`

**Interfaces:**
- Consumes: `atualizarApelido` de `@/app/perfil/actions`, `Button` de `@/components/ui/button`
- Produces: `ApelidoForm({ apelidoAtual: string })` — exportação nomeada

- [ ] **Step 1: Escrever os testes**

Crie `src/components/perfil/__tests__/apelido-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApelidoForm } from "@/components/perfil/apelido-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarApelido: vi.fn(),
}));

describe("ApelidoForm", () => {
  it("renderiza o campo de apelido pré-preenchido", () => {
    render(<ApelidoForm apelidoAtual="Zezão" />);
    const input = screen.getByLabelText(/apelido/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Zezão");
  });

  it("renderiza o botão de salvar", () => {
    render(<ApelidoForm apelidoAtual="Zezão" />);
    expect(
      screen.getByRole("button", { name: /salvar apelido/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- apelido-form
```

Esperado: `ApelidoForm` não existe → FAIL.

- [ ] **Step 3: Implementar o componente**

Crie `src/components/perfil/apelido-form.tsx`:

```tsx
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- apelido-form
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/perfil/apelido-form.tsx src/components/perfil/__tests__/apelido-form.test.tsx
git commit -m "feat: componente ApelidoForm com testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: `AvatarForm` — componente e testes

**Files:**
- Create: `src/components/perfil/avatar-form.tsx`
- Create: `src/components/perfil/__tests__/avatar-form.test.tsx`

**Interfaces:**
- Consumes:
  - `atualizarAvatar` de `@/app/perfil/actions`
  - `ESTILOS_AVATAR`, `avatarUrlFromEstilo`, `estiloDoAvatar` de `@/lib/avatars`
  - `Button` de `@/components/ui/button`
- Produces: `AvatarForm({ avatarAtual: string })` — exportação nomeada

- [ ] **Step 1: Escrever os testes**

Crie `src/components/perfil/__tests__/avatar-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarForm } from "@/components/perfil/avatar-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarAvatar: vi.fn(),
}));

const avatarFunEmoji = "https://api.dicebear.com/9.x/fun-emoji/svg?seed=gol";
const avatarPixelArt = "https://api.dicebear.com/9.x/pixel-art/svg?seed=pixel-verde";

describe("AvatarForm", () => {
  it("renderiza as abas de estilo", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(screen.getByRole("tab", { name: /emoji/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /aventureiro/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /robô/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pixel/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /lorelei/i })).toBeInTheDocument();
  });

  it("a aba do estilo atual começa selecionada", () => {
    render(<AvatarForm avatarAtual={avatarPixelArt} />);
    expect(screen.getByRole("tab", { name: /pixel/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("renderiza 6 opções de avatar no grid", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("trocar de aba atualiza o grid de avatares", async () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    const abaRobo = screen.getByRole("tab", { name: /robô/i });
    await userEvent.click(abaRobo);
    expect(abaRobo).toHaveAttribute("aria-selected", "true");
    // O grid ainda exibe 6 opções (agora do estilo bottts)
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("botão salvar desabilitado quando avatar selecionado é o atual", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(
      screen.getByRole("button", { name: /salvar avatar/i })
    ).toBeDisabled();
  });

  it("botão salvar habilitado ao selecionar avatar diferente", async () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    const opcoes = screen.getAllByRole("radio");
    // Seleciona o segundo avatar (diferente do atual)
    await userEvent.click(opcoes[1]);
    expect(
      screen.getByRole("button", { name: /salvar avatar/i })
    ).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- avatar-form
```

Esperado: `AvatarForm` não existe → FAIL.

- [ ] **Step 3: Implementar o componente**

Crie `src/components/perfil/avatar-form.tsx`:

```tsx
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- avatar-form
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/perfil/avatar-form.tsx src/components/perfil/__tests__/avatar-form.test.tsx
git commit -m "feat: componente AvatarForm com múltiplos estilos e testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `SenhaForm` — componente e testes

**Files:**
- Create: `src/components/perfil/senha-form.tsx`
- Create: `src/components/perfil/__tests__/senha-form.test.tsx`

**Interfaces:**
- Consumes: `atualizarSenha` de `@/app/perfil/actions`, `Button` de `@/components/ui/button`
- Produces: `SenhaForm()` — exportação nomeada, sem props

- [ ] **Step 1: Escrever os testes**

Crie `src/components/perfil/__tests__/senha-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SenhaForm } from "@/components/perfil/senha-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarSenha: vi.fn(),
}));

describe("SenhaForm", () => {
  it("renderiza os três campos de senha", () => {
    render(<SenhaForm />);
    expect(screen.getByLabelText(/senha atual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nova senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar nova senha/i)).toBeInTheDocument();
  });

  it("os campos são do tipo password", () => {
    render(<SenhaForm />);
    const inputs = screen.getAllByDisplayValue("");
    for (const input of inputs) {
      expect(input).toHaveAttribute("type", "password");
    }
  });

  it("renderiza o botão de salvar", () => {
    render(<SenhaForm />);
    expect(
      screen.getByRole("button", { name: /salvar nova senha/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- senha-form
```

Esperado: `SenhaForm` não existe → FAIL.

- [ ] **Step 3: Implementar o componente**

Crie `src/components/perfil/senha-form.tsx`:

```tsx
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- senha-form
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/perfil/senha-form.tsx src/components/perfil/__tests__/senha-form.test.tsx
git commit -m "feat: componente SenhaForm com testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Página `/perfil` (Server Component)

**Files:**
- Create: `src/app/perfil/page.tsx`

**Interfaces:**
- Consumes:
  - `getPerfil` de `@/lib/auth/profile` → `Profile | null`
  - `ApelidoForm({ apelidoAtual: string })` de `@/components/perfil/apelido-form`
  - `AvatarForm({ avatarAtual: string })` de `@/components/perfil/avatar-form`
  - `SenhaForm()` de `@/components/perfil/senha-form`
  - `avatarPadrao(seed: string): string` de `@/lib/avatars`
  - `redirect` de `next/navigation`
- Produces: default export `PerfilPage` (Server Component)

*Nota:* Server Components não são testados com RTL neste projeto — a proteção de rota e o carregamento do perfil são verificados via smoke test manual ou e2e.

- [ ] **Step 1: Criar a página**

Crie `src/app/perfil/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth/profile";
import { avatarPadrao } from "@/lib/avatars";
import { ApelidoForm } from "@/components/perfil/apelido-form";
import { AvatarForm } from "@/components/perfil/avatar-form";
import { SenhaForm } from "@/components/perfil/senha-form";

export default async function PerfilPage() {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-foreground">
      <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-tight">
        Meu Perfil
      </h1>
      <div className="flex flex-col gap-6">
        <ApelidoForm apelidoAtual={perfil.apelido ?? ""} />
        <AvatarForm
          avatarAtual={perfil.avatar_url ?? avatarPadrao(perfil.id)}
        />
        <SenhaForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verificar o build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: build sem erros de tipo.

- [ ] **Step 3: Rodar o servidor de dev e verificar a página manualmente**

```bash
npm run dev
```

Abra `http://localhost:3000/perfil` com usuário logado. Confirme:
- Três cards são exibidos (Apelido, Avatar, Senha)
- Apelido está pré-preenchido
- Avatar mostra o estilo atual selecionado
- Sem usuário logado: redireciona para `/entrar`

- [ ] **Step 4: Commit**

```bash
git add src/app/perfil/page.tsx
git commit -m "feat: página /perfil com cards de apelido, avatar e senha

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: `UserMenu` — dropdown com "Editar perfil" e testes

**Files:**
- Modify: `src/components/auth/user-menu.tsx`
- Create: `src/components/auth/__tests__/user-menu.test.tsx`

**Interfaces:**
- Consumes:
  - `Link` de `next/link`
  - `ChevronDown`, `LogOut`, `User` de `lucide-react`
  - `motion`, `AnimatePresence`, `useReducedMotion` de `framer-motion` (mockados nos testes)
- Produces: `UserMenu({ apelido: string; avatarUrl: string })` — mesma assinatura de props, componente agora `"use client"`

- [ ] **Step 1: Escrever os testes**

Crie `src/components/auth/__tests__/user-menu.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/auth/user-menu";

const props = { apelido: "Zezão", avatarUrl: "https://x/avatar.svg" };

describe("UserMenu", () => {
  it("exibe o apelido no trigger", () => {
    render(<UserMenu {...props} />);
    expect(screen.getByText("Zezão")).toBeInTheDocument();
  });

  it("dropdown começa fechado", () => {
    render(<UserMenu {...props} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("abre o dropdown ao clicar no trigger", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("exibe links de Editar perfil e Sair", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menuitem", { name: /editar perfil/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sair/i })).toBeInTheDocument();
  });

  it("link Editar perfil aponta para /perfil", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    const link = screen.getByRole("menuitem", { name: /editar perfil/i });
    expect(link).toHaveAttribute("href", "/perfil");
  });

  it("fecha ao pressionar Escape", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha ao clicar fora do componente", async () => {
    render(
      <div>
        <UserMenu {...props} />
        <button>Fora</button>
      </div>
    );
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /fora/i }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -- user-menu
```

Esperado: dropdown não existe no componente atual → FAIL (queryByRole("menu") passará pois retorna null, mas o teste de abertura falhará).

- [ ] **Step 3: Implementar o dropdown**

Substitua TODO o conteúdo de `src/components/auth/user-menu.tsx`:

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function UserMenu({
  apelido,
  avatarUrl,
}: {
  apelido: string;
  avatarUrl: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={apelido}
        className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full bg-muted"
        />
        <span className="hidden text-sm font-medium sm:inline">{apelido}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? {} : { opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-xl border border-border bg-card shadow-md"
          >
            <div className="p-1">
              <Link
                href="/perfil"
                role="menuitem"
                onClick={() => setAberto(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Editar perfil
              </Link>
              <div className="my-1 border-t border-border" />
              <form action="/auth/sair" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test -- user-menu
```

Esperado: PASS.

- [ ] **Step 5: Rodar toda a suite de testes**

```bash
npm test
```

Esperado: todos os testes passam. Se algum teste pré-existente quebrar (especialmente `site-header.test.tsx` que renderiza `HeaderBrand`), investigue e corrija antes de commitar.

- [ ] **Step 6: Commit final**

```bash
git add src/components/auth/user-menu.tsx src/components/auth/__tests__/user-menu.test.tsx
git commit -m "feat: UserMenu vira dropdown com link para /perfil

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Verificação final

Após todas as tasks:

- [ ] `npm test` — todos os testes passam
- [ ] `npm run build` — build sem erros
- [ ] Abrir `http://localhost:3000` logado → clicar no avatar → dropdown aparece com "Editar perfil" e "Sair"
- [ ] Clicar "Editar perfil" → chega em `/perfil` com os três cards
- [ ] Alterar apelido → salvar → mensagem "Apelido atualizado!" aparece
- [ ] Trocar de aba de avatar → grid atualiza → selecionar avatar diferente → "Salvar avatar" habilita → salvar → "Avatar atualizado!" aparece
- [ ] Alterar senha com senha atual incorreta → "Senha atual incorreta." aparece
- [ ] Acessar `/perfil` sem login → redireciona para `/entrar`
