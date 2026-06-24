# Cravou! — Fase 0: Fundação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar o esqueleto da aplicação "Cravou!" — Next.js + Tailwind + shadcn/ui, com alternância de tema dark/light funcional, uma landing de marca, cliente Supabase conectado e deploy na Vercel.

**Architecture:** App Next.js 15 (App Router, TypeScript) hospedado na Vercel. UI com Tailwind CSS v4 + shadcn/ui. Tema dark/light via `next-themes` persistido. Dados via Supabase (apenas wiring nesta fase, sem tabelas ainda). Testes com Vitest + React Testing Library.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, next-themes, @supabase/supabase-js, @supabase/ssr, Vitest, @testing-library/react.

## Global Constraints

- Nome da aplicação exibido ao usuário: **Cravou!** (com ponto de exclamação) — verbatim.
- Pasta raiz do projeto: `Bolao-TI` (a app Next.js vive na raiz dessa pasta).
- Idioma da UI: Português do Brasil.
- Segredos (chaves Supabase service role, API-Football) NUNCA no client; apenas server/Edge Functions.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são as únicas chaves expostas ao browser.
- Mobile-first; tema padrão segue preferência do sistema.
- Commits frequentes, um por task.

---

### Task 1: Scaffold do projeto Next.js + git

**Files:**
- Create: `Bolao-TI/` (projeto Next.js completo via create-next-app)
- Create: `Bolao-TI/.gitignore` (gerado)
- Modify: `Bolao-TI/README.md`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: projeto Next.js rodável com `npm run dev`; raiz git inicializada.

- [ ] **Step 1: Scaffold do Next.js na pasta atual**

A pasta `Bolao-TI` já existe (com `docs/`). Rode o create-next-app dentro dela:

```bash
cd "d:/Projetos/Bolao-TI"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Quando perguntar sobre sobrescrever arquivos existentes (por causa de `docs/`), confirme manter — `create-next-app` não apaga `docs/`.

- [ ] **Step 2: Verificar que o dev server sobe**

Run: `npm run dev`
Expected: servidor inicia em `http://localhost:3000` sem erros. Encerre com Ctrl+C.

- [ ] **Step 3: Inicializar git e primeiro commit**

```bash
cd "d:/Projetos/Bolao-TI"
git init
git add -A
git commit -m "chore: scaffold Next.js app for Cravou!

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Verificar o commit**

Run: `git log --oneline -1`
Expected: mostra o commit "chore: scaffold Next.js app for Cravou!"

---

### Task 2: Configurar Vitest + React Testing Library

**Files:**
- Create: `Bolao-TI/vitest.config.ts`
- Create: `Bolao-TI/vitest.setup.ts`
- Create: `Bolao-TI/src/lib/__tests__/smoke.test.ts`
- Modify: `Bolao-TI/package.json` (script `test`)

**Interfaces:**
- Consumes: projeto Next.js da Task 1.
- Produces: comando `npm test` funcional para todas as tasks seguintes.

- [ ] **Step 1: Instalar dependências de teste**

```bash
cd "d:/Projetos/Bolao-TI"
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Criar config do Vitest**

Create `Bolao-TI/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `Bolao-TI/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Adicionar script de teste**

Modify `Bolao-TI/package.json` — adicione em `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escrever um teste de fumaça**

Create `Bolao-TI/src/lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("roda o test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: PASS, 1 teste passa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: configurar Vitest + React Testing Library

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Provider de tema dark/light + toggle

**Files:**
- Create: `Bolao-TI/src/components/theme-provider.tsx`
- Create: `Bolao-TI/src/components/theme-toggle.tsx`
- Create: `Bolao-TI/src/components/__tests__/theme-toggle.test.tsx`
- Modify: `Bolao-TI/src/app/layout.tsx`

**Interfaces:**
- Consumes: app da Task 1, test runner da Task 2.
- Produces: `<ThemeProvider>` (wrapper do layout) e `<ThemeToggle />` (botão que alterna `light`/`dark`).

- [ ] **Step 1: Instalar next-themes e ícones**

```bash
cd "d:/Projetos/Bolao-TI"
npm install next-themes lucide-react
```

- [ ] **Step 2: Escrever o teste do toggle (falhando)**

Create `Bolao-TI/src/components/__tests__/theme-toggle.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  it("renderiza um botão acessível para alternar o tema", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(
      screen.getByRole("button", { name: /alternar tema/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste para confirmar a falha**

Run: `npm test -- theme-toggle`
Expected: FAIL — módulos `theme-provider`/`theme-toggle` não existem.

- [ ] **Step 4: Implementar o ThemeProvider**

Create `Bolao-TI/src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
```

- [ ] **Step 5: Implementar o ThemeToggle**

Create `Bolao-TI/src/components/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Alternar tema"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted transition-colors"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
```

- [ ] **Step 6: Envolver o layout com o ThemeProvider**

Modify `Bolao-TI/src/app/layout.tsx` — adicione `suppressHydrationWarning` no `<html>` e envolva `{children}`:

```tsx
import { ThemeProvider } from "@/components/theme-provider";

// dentro do return:
// <html lang="pt-BR" suppressHydrationWarning>
//   <body className={...}>
//     <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
//       {children}
//     </ThemeProvider>
//   </body>
// </html>
```

Aplique: troque `lang="en"` por `lang="pt-BR"`, adicione `suppressHydrationWarning` ao `<html>`, importe e envolva `{children}` com `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.

- [ ] **Step 7: Rodar o teste**

Run: `npm test -- theme-toggle`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tema dark/light com toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Identidade visual e landing do Cravou!

**Files:**
- Modify: `Bolao-TI/src/app/globals.css` (tokens de cor do tema esportivo)
- Modify: `Bolao-TI/src/app/page.tsx` (landing)
- Create: `Bolao-TI/src/components/site-header.tsx`
- Create: `Bolao-TI/src/components/__tests__/site-header.test.tsx`
- Modify: `Bolao-TI/src/app/layout.tsx` (metadata/título)

**Interfaces:**
- Consumes: `ThemeToggle` da Task 3.
- Produces: `<SiteHeader />` com a marca "Cravou!" e o toggle; landing inicial.

- [ ] **Step 1: Escrever o teste do header (falhando)**

Create `Bolao-TI/src/components/__tests__/site-header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  it("exibe a marca Cravou!", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <SiteHeader />
      </ThemeProvider>
    );
    expect(screen.getByText("Cravou!")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `npm test -- site-header`
Expected: FAIL — `site-header` não existe.

- [ ] **Step 3: Implementar o SiteHeader**

Create `Bolao-TI/src/components/site-header.tsx`:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <span className="text-2xl font-extrabold tracking-tight text-primary">
          Cravou!
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Definir tokens do tema esportivo**

Modify `Bolao-TI/src/app/globals.css` — adicione/ajuste as variáveis de cor para um tema verde-campo. Dentro do bloco `:root` e do bloco `.dark` (criando-o se não existir), defina `--primary` para um verde campo (ex.: `oklch(0.55 0.15 150)` no light) e um acento vibrante. Mantenha os demais tokens do shadcn/Tailwind já presentes. Garanta que exista a variante `.dark { ... }` com os mesmos tokens em versão escura.

- [ ] **Step 5: Montar a landing**

Modify `Bolao-TI/src/app/page.tsx` — substitua o conteúdo padrão por:

```tsx
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
        <h1 className="text-balance text-4xl font-extrabold sm:text-5xl">
          Cravou! — o bolão da Copa
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Registre seus palpites, acompanhe os jogos e suba no ranking.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Atualizar o título/metadata**

Modify `Bolao-TI/src/app/layout.tsx` — ajuste o `metadata`:

```tsx
export const metadata = {
  title: "Cravou! — Bolão da Copa",
  description: "Registre seus palpites da Copa e suba no ranking.",
};
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test`
Expected: PASS (smoke, theme-toggle, site-header).

- [ ] **Step 8: Verificar visualmente**

Run: `npm run dev` e abra `http://localhost:3000`.
Expected: landing "Cravou!" renderiza; o toggle alterna dark/light e persiste após refresh. Encerre com Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: landing e identidade visual do Cravou!

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wiring do cliente Supabase

**Files:**
- Create: `Bolao-TI/.env.local` (não versionado)
- Create: `Bolao-TI/.env.example`
- Create: `Bolao-TI/src/lib/supabase/client.ts`
- Create: `Bolao-TI/src/lib/supabase/server.ts`
- Create: `Bolao-TI/src/lib/supabase/__tests__/client.test.ts`

**Interfaces:**
- Consumes: variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: `createClient()` (browser) em `@/lib/supabase/client` e `createClient()` (server) em `@/lib/supabase/server`, usados por todas as fases seguintes.

- [ ] **Step 1: Instalar libs do Supabase**

```bash
cd "d:/Projetos/Bolao-TI"
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Criar arquivos de ambiente**

Create `Bolao-TI/.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Create `Bolao-TI/.env.local` com os valores reais do projeto Supabase (obtidos no painel Supabase → Project Settings → API). Confirme que `.env.local` está no `.gitignore` (o create-next-app já inclui `.env*`).

- [ ] **Step 3: Escrever o teste do client (falhando)**

Create `Bolao-TI/src/lib/supabase/__tests__/client.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";

describe("createClient (browser)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("cria um client com método from()", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    expect(typeof supabase.from).toBe("function");
  });
});
```

- [ ] **Step 4: Rodar o teste para confirmar a falha**

Run: `npm test -- supabase`
Expected: FAIL — `@/lib/supabase/client` não existe.

- [ ] **Step 5: Implementar o client de browser**

Create `Bolao-TI/src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 6: Implementar o client de servidor**

Create `Bolao-TI/src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component; ignorável quando há middleware
          }
        },
      },
    }
  );
}
```

- [ ] **Step 7: Rodar o teste**

Run: `npm test -- supabase`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wiring do cliente Supabase (browser + server)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Deploy na Vercel

**Files:**
- Nenhum arquivo de código novo (configuração na Vercel).

**Interfaces:**
- Consumes: o projeto completo das tasks anteriores.
- Produces: URL pública de produção do "Cravou!".

- [ ] **Step 1: Garantir build de produção local**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Subir o repositório para o GitHub**

Crie um repositório (ex.: `cravou`) e faça push:

```bash
cd "d:/Projetos/Bolao-TI"
gh repo create cravou --private --source=. --remote=origin --push
```

- [ ] **Step 3: Importar na Vercel**

No painel da Vercel: New Project → importar o repo `cravou`. Framework detectado: Next.js.

- [ ] **Step 4: Configurar variáveis de ambiente na Vercel**

Adicione em Project → Settings → Environment Variables:
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mesmos valores do `.env.local`).

- [ ] **Step 5: Deploy e verificação**

Dispare o deploy. Expected: a landing "Cravou!" abre na URL pública e o toggle dark/light funciona.

---

## Self-Review

**Spec coverage (Fase 0):** scaffold Next.js+Tailwind+shadcn (Task 1, 4), tema dark/light
(Task 3), marca Cravou! (Task 4), cliente Supabase (Task 5), deploy Vercel (Task 6),
variáveis de ambiente (Task 5, 6). Entrega da fase ("app no ar com tela inicial") coberta.

**Observações:**
- shadcn/ui: o create-next-app com Tailwind já dá a base; componentes shadcn específicos
  serão adicionados sob demanda nas próximas fases (YAGNI nesta fase).
- Auth, tabelas, jogos, palpites e ranking são das Fases 1–4 (planos próprios).
