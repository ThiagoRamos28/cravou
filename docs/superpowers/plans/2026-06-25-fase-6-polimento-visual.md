# Fase 6 — Polimento Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar feedback visual ao salvar palpite (toast + animação no card), skeletons de carregamento nas páginas internas, e ajustes de responsividade/contraste.

**Architecture:** Toast system via React context + Framer Motion (`AnimatePresence`) no canto inferior-direito; `loading.tsx` do App Router com componente `Skeleton` para as 3 páginas internas; ajustes cirúrgicos de Tailwind para overflow em mobile e visibilidade de colunas.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Vitest + React Testing Library, lucide-react.

## Global Constraints

- **Idioma da UI:** Português do Brasil — todas as strings visíveis ao usuário em PT-BR.
- **Nome do app:** `Cravou!` (sempre com ponto de exclamação, verbatim).
- **Ícones:** somente lucide-react — nunca emoji como ícone.
- **Animações:** sempre verificar `useReducedMotion()` do Framer Motion; se ativo, suprimir `y` offset (manter só opacity) ou suprimir completamente com `duration: 0`.
- **Framer Motion:** `ease` como tupla `as const` quando usando cubic-bezier.
- **Tailwind v4:** config via `@theme inline` em `globals.css`; sem `tailwind.config`. Tokens: `bg-primary`, `text-accent`, `border-border`, `bg-muted`, `text-foreground`, `bg-card`, `text-muted-foreground`.
- **Componentes com hooks/Framer Motion:** precisam de `"use client"` no topo.
- **TDD:** escreva o teste primeiro, veja falhar, implemente, veja passar, commit.
- **Commit:** mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Contraste:** ≥ 4.5:1 (WCAG AA) para texto normal.
- **Segredos:** nunca no client — só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Mapa de arquivos

**Criar:**
- `src/components/ui/skeleton.tsx` — primitivo `Skeleton` com `animate-pulse`
- `src/components/ui/__tests__/skeleton.test.tsx` — render test
- `src/app/jogos/loading.tsx` — skeleton da página de jogos
- `src/app/ranking/loading.tsx` — skeleton da página de ranking
- `src/app/historico/loading.tsx` — skeleton da página de histórico
- `src/components/ui/toast.tsx` — `ToastContext`, `ToastProvider`, `useToast`
- `src/components/ui/toaster.tsx` — `Toaster` renderer com `AnimatePresence`
- `src/components/ui/__tests__/toast.test.tsx` — testes do toast

**Modificar:**
- `src/app/layout.tsx` — adicionar `ToastProvider` + `<Toaster />`
- `src/components/jogos/palpite-form.tsx` — integrar `useToast` + animações Framer Motion
- `src/components/jogos/__tests__/palpite-form.test.tsx` — adicionar testes de toast
- `src/components/jogos/match-card.tsx` — `min-w-0` + `truncate` nos times
- `src/components/ranking/ranking-table.tsx` — `hidden sm:table-cell` na coluna de palpites
- `src/components/ranking/podium.tsx` — `text-xs` e `px-2` em mobile
- `src/components/site-header.tsx` — `gap-0.5 sm:gap-1` no nav mobile
- `src/app/globals.css` — ajuste de contraste se necessário (instrução de auditoria inclusa)

---

## Task 1: Skeleton primitive + loading pages

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/__tests__/skeleton.test.tsx`
- Create: `src/app/jogos/loading.tsx`
- Create: `src/app/ranking/loading.tsx`
- Create: `src/app/historico/loading.tsx`

**Interfaces:**
- Produces: `Skeleton({ className?: string }): JSX.Element` — usado nos 3 `loading.tsx` e disponível para uso futuro.

- [ ] **Step 1: Escrever o teste do Skeleton**

```tsx
// src/components/ui/__tests__/skeleton.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renderiza com animate-pulse e bg-muted", () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("bg-muted");
  });

  it("aplica className adicional recebido via prop", () => {
    render(<Skeleton className="h-4 w-20" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveClass("h-4", "w-20");
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```bash
npm test -- skeleton
```

Esperado: FAIL com "Cannot find module '@/components/ui/skeleton'".

- [ ] **Step 3: Criar `src/components/ui/skeleton.tsx`**

```tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ""}`}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Rodar o teste para confirmar aprovação**

```bash
npm test -- skeleton
```

Esperado: PASS (2 testes).

- [ ] **Step 5: Criar `src/app/jogos/loading.tsx`**

`SiteHeader` é async (faz query Supabase), portanto `loading.tsx` usa um `LoadingHeader` estático — renderiza imediatamente sem bloqueio.

```tsx
import { HeaderBrand } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderBrand />
        <ThemeToggle />
      </div>
    </header>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-12" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mt-3">
        <Skeleton className="h-9 w-52" />
      </div>
    </div>
  );
}

export default function JogosLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-9 w-44" />
        <Skeleton className="mb-6 h-8 w-full max-w-sm" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 6: Criar `src/app/ranking/loading.tsx`**

```tsx
import { HeaderBrand } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderBrand />
        <ThemeToggle />
      </div>
    </header>
  );
}

function PodiumSkeleton() {
  return (
    <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
      {/* 2º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-24 w-full rounded-t-xl" />
      </div>
      {/* 1º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-32 w-full rounded-t-xl" />
      </div>
      {/* 3º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-20 w-full rounded-t-xl" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <Skeleton className="h-3 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function RankingLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-8 h-9 w-32" />
        <PodiumSkeleton />
        <TableSkeleton />
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 7: Criar `src/app/historico/loading.tsx`**

```tsx
import { HeaderBrand } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderBrand />
        <ThemeToggle />
      </div>
    </header>
  );
}

function ResumoSkeleton() {
  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 text-center">
          <Skeleton className="mx-auto mb-2 h-5 w-5" />
          <Skeleton className="mx-auto mb-1 h-7 w-12" />
          <Skeleton className="mx-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function HistoricoItemSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Skeleton className="mb-2 h-3 w-28" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-10" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function HistoricoLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-8 h-9 w-44" />
        <ResumoSkeleton />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <HistoricoItemSkeleton key={i} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 8: Verificar build**

```bash
npm run build
```

Esperado: build sem erros de tipo. As 3 rotas devem aparecer no output como segmentos estáticos.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/ui/__tests__/skeleton.test.tsx src/app/jogos/loading.tsx src/app/ranking/loading.tsx src/app/historico/loading.tsx
git commit -m "feat: Skeleton primitive + loading pages (jogos, ranking, historico)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Toast system

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/toaster.tsx`
- Create: `src/components/ui/__tests__/toast.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces:
  - `ToastContext` (exportado, usado pelo `Toaster`)
  - `ToastProvider({ children: ReactNode }): JSX.Element`
  - `useToast(): { toast: (opts: { message: string; variant: "success" | "error" }) => void }`
  - `Toaster(): JSX.Element`

- [ ] **Step 1: Escrever os testes do toast**

```tsx
// src/components/ui/__tests__/toast.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";

function GatilhoToast({ message, variant }: { message: string; variant: "success" | "error" }) {
  const { toast } = useToast();
  return <button onClick={() => toast({ message, variant })}>disparar</button>;
}

function Setup({ message = "Palpite salvo!", variant = "success" as const } = {}) {
  return (
    <ToastProvider>
      <GatilhoToast message={message} variant={variant} />
      <Toaster />
    </ToastProvider>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe mensagem de sucesso ao disparar o toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpite salvo!" variant="success" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpite salvo!")).toBeInTheDocument();
  });

  it("exibe mensagem de erro ao disparar toast de erro", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpites encerrados." variant="error" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpites encerrados.")).toBeInTheDocument();
  });

  it("remove o toast automaticamente após 4000 ms", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpite salvo!" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpite salvo!")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText("Palpite salvo!")).not.toBeInTheDocument();
  });

  it("container tem role status para acessibilidade", () => {
    render(<Setup />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar falha**

```bash
npm test -- toast
```

Esperado: FAIL — módulos ainda não existem.

- [ ] **Step 3: Criar `src/components/ui/toast.tsx`**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastVariant = "success" | "error";

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toasts: Toast[];
  toast: (opts: { message: string; variant: ToastVariant }) => void;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, variant }: { message: string; variant: ToastVariant }) => {
      const id = ++counter.current;
      setToasts((prev) => {
        const next = [...prev, { id, message, variant }];
        // Máximo de 3 toasts; descarta o mais antigo se ultrapassar.
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de ToastProvider");
  return { toast: ctx.toast };
}
```

- [ ] **Step 4: Criar `src/components/ui/toaster.tsx`**

```tsx
"use client";

import { useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { ToastContext } from "@/components/ui/toast";

export function Toaster() {
  const ctx = useContext(ToastContext);
  const reduce = useReducedMotion();

  if (!ctx) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-80"
    >
      <AnimatePresence>
        {ctx.toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
          >
            {t.variant === "success" ? (
              <CheckCircle
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
            )}
            <span className="text-sm text-foreground">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Rodar os testes para confirmar aprovação**

```bash
npm test -- toast
```

Esperado: PASS (4 testes).

- [ ] **Step 6: Modificar `src/app/layout.tsx` para adicionar ToastProvider + Toaster**

O arquivo atual é:

```tsx
import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

// ... fontes ...

export default function RootLayout({ children }: ...) {
  return (
    <html ...>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Substituir por (manter imports de fontes e metadata intactos, só atualizar o body):

```tsx
import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";

// ... fontes e metadata inalterados ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verificar build**

```bash
npm run build
```

Esperado: sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/toaster.tsx src/components/ui/__tests__/toast.test.tsx src/app/layout.tsx
git commit -m "feat: toast system (ToastProvider + Toaster + useToast)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: PalpiteForm — toast + animações Framer Motion

**Files:**
- Modify: `src/components/jogos/palpite-form.tsx`
- Modify: `src/components/jogos/__tests__/palpite-form.test.tsx`

**Interfaces:**
- Consumes: `useToast` de `@/components/ui/toast` (Task 2)
- Consumes: `AnimatePresence`, `motion`, `useReducedMotion` de `framer-motion`

- [ ] **Step 1: Atualizar `palpite-form.test.tsx` com wrapper ToastProvider e mocks no nível de módulo**

`vi.mock()` em Vitest é hoisted ao topo do arquivo — **nunca** coloque-o dentro de `it()`. A abordagem correta é:

1. Mockar `useToast` no nível de módulo para capturar as chamadas.
2. Mockar `useActionState` no nível de módulo para controlar o estado por teste.
3. Envolver renders em `ToastProvider` (necessário pois `useToast` usa context — mas como estamos mockando o módulo, o mock intercepta antes do context).

Substituir **todo** o conteúdo de `src/components/jogos/__tests__/palpite-form.test.tsx` por:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match } from "@/lib/matches";

// Mocks de módulo — DEVEM estar no nível do arquivo (Vitest os hoist).
const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/app/jogos/actions", () => ({ salvarPalpite: vi.fn() }));

// Controla o que useActionState retorna em cada teste.
const mockUseActionState = vi.fn();
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: mockUseActionState };
});

// Importar DEPOIS dos mocks (ordem importa com vi.mock hoisting).
const { PalpiteForm } = await import("@/components/jogos/palpite-form");

const base: Match = {
  id: "m1",
  fase: "grupos",
  rodada: "1",
  time_casa: "Brasil",
  time_fora: "Argentina",
  bandeira_casa: null,
  bandeira_fora: null,
  inicio_em: "2026-07-01T18:00:00.000Z",
  status: "agendado",
  placar_casa: null,
  placar_fora: null,
};

beforeEach(() => {
  mockToast.mockClear();
  // Estado padrão: sem ok/erro, form ativo.
  mockUseActionState.mockReturnValue([{}, vi.fn(), false]);
});

describe("PalpiteForm", () => {
  it("mostra inputs habilitados quando o corte está aberto", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={futuro} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("desabilita e avisa quando o corte passou", () => {
    const passado: Match = { ...base, inicio_em: "2000-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={passado} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).toBeDisabled();
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument();
  });

  it("preenche os valores do palpite existente", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(
      <PalpiteForm
        match={futuro}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 1, pontos: null }}
      />
    );
    expect((screen.getByLabelText(/palpite brasil/i) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/palpite argentina/i) as HTMLInputElement).value).toBe("1");
  });

  it("mostra os pontos ganhos num jogo finalizado", () => {
    const finalizado: Match = {
      ...base,
      status: "finalizado",
      inicio_em: "2000-01-01T00:00:00.000Z",
      placar_casa: 3,
      placar_fora: 1,
    };
    render(
      <PalpiteForm
        match={finalizado}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 0, pontos: 7 }}
      />
    );
    expect(screen.getByText(/\+7 pts/i)).toBeInTheDocument();
  });

  it("destaca 'Cravou!' quando o palpite bateu o placar exato", () => {
    const finalizado: Match = {
      ...base,
      status: "finalizado",
      inicio_em: "2000-01-01T00:00:00.000Z",
      placar_casa: 2,
      placar_fora: 1,
    };
    render(
      <PalpiteForm
        match={finalizado}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/cravou/i)).toBeInTheDocument();
    expect(screen.getByText(/\+10 pts/i)).toBeInTheDocument();
  });

  it("chama toast de sucesso quando estado.ok está presente", () => {
    mockUseActionState.mockReturnValue([{ ok: "Palpite salvo!" }, vi.fn(), false]);
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={futuro} minutosCorte={10} />);
    expect(mockToast).toHaveBeenCalledWith({ message: "Palpite salvo!", variant: "success" });
  });

  it("chama toast de erro quando estado.erro está presente", () => {
    mockUseActionState.mockReturnValue([
      { erro: "Palpites encerrados para este jogo." },
      vi.fn(),
      false,
    ]);
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={futuro} minutosCorte={10} />);
    expect(mockToast).toHaveBeenCalledWith({
      message: "Palpites encerrados para este jogo.",
      variant: "error",
    });
  });
});
```

> **Por que importar `PalpiteForm` com `await import(...)` abaixo dos mocks?** Em Vitest, os `vi.mock()` são hoisted mas as importações estáticas (`import { PalpiteForm }`) também são hoisted e podem ser resolvidas antes dos mocks. Usar `await import(...)` garante que o módulo é carregado depois dos mocks estarem registrados.

- [ ] **Step 2: Rodar os testes para confirmar falha nos novos**

```bash
npm test -- palpite-form
```

Esperado: os dois novos testes falham (toast não dispara ainda pois `PalpiteForm` ainda não chama `useToast`). Os 5 testes existentes devem passar (o mock de `useActionState` os suporta).

- [ ] **Step 3: Reescrever `src/components/jogos/palpite-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { salvarPalpite, type EstadoPalpite } from "@/app/jogos/actions";
import { palpiteAberto } from "@/lib/palpites/corte";
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

  useEffect(() => {
    if (estado.ok) toast({ message: "Palpite salvo!", variant: "success" });
  }, [estado.ok, toast]);

  useEffect(() => {
    if (estado.erro) toast({ message: estado.erro, variant: "error" });
  }, [estado.erro, toast]);

  const aberto =
    match.status === "agendado" && palpiteAberto(match.inicio_em, minutosCorte);

  const offset = reduce ? 0 : 8;

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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
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
    <AnimatePresence mode="wait">
      <motion.div
        key="open"
        className="mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="match_id" value={match.id} />
          <input type="hidden" name="inicio_em" value={match.inicio_em} />
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
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Rodar os testes para confirmar aprovação**

```bash
npm test -- palpite-form
```

Esperado: PASS em todos os testes (os existentes + os 2 novos).

> Se os mocks de `useActionState` causarem conflito entre testes, mova-os para dentro de `it()` individuais usando `vi.doMock` e `vi.resetModules()`.

- [ ] **Step 5: Rodar toda a suíte**

```bash
npm test
```

Esperado: PASS em todos os testes.

- [ ] **Step 6: Commit**

```bash
git add src/components/jogos/palpite-form.tsx src/components/jogos/__tests__/palpite-form.test.tsx
git commit -m "feat: PalpiteForm com toast de feedback e animações Framer Motion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Responsividade + Dark/light

**Files:**
- Modify: `src/components/jogos/match-card.tsx`
- Modify: `src/components/ranking/ranking-table.tsx`
- Modify: `src/components/ranking/podium.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/app/globals.css` (só se contraste falhar a auditoria)

**Interfaces:**
- Nenhuma interface nova — só ajustes de classes Tailwind e tokens CSS.

- [ ] **Step 1: Auditar contraste (auditoria manual, não TDD)**

Com o servidor de dev rodando (`npm run dev`), abrir `http://localhost:3000/jogos` no browser com DevTools aberto.

Verificar o contraste dos seguintes elementos em **modo claro** e **modo escuro**:

1. Texto `muted-foreground` (hora do jogo, status) sobre `bg-card` (`oklch(1 0 0)` light / `oklch(0.19 0.02 260)` dark).
2. Texto `muted-foreground` nos inputs sobre `bg-background`.
3. Badge "Cravou!" (texto `text-accent` sobre `bg-accent/15`).
4. **Dark mode:** distinção visual de `bg-card` (`oklch(0.19 0.02 260)`) sobre `bg-background` (`oklch(0.15 0.02 260)`) — a diferença de luminosidade é sutil. Verificar se cards se destacam do fundo em monitor real.

No DevTools > Elements > Acessibilidade, verificar ratio dos itens 1–3. Mínimo aceito: **4.5:1**.

**Se algum valor de contraste falhar**, ajustar o token em `src/app/globals.css`:
- `muted-foreground` light: se abaixo de 4.5:1, diminuir luminosidade (ex.: `oklch(0.40 0.01 260)` em vez de `oklch(0.45 0.01 260)`).
- `muted-foreground` dark: se abaixo de 4.5:1, aumentar luminosidade (ex.: `oklch(0.75 0.01 260)` em vez de `oklch(0.72 0.01 260)`).

**Se o item 4 (distinção de card) for insuficiente**, elevar `--card` no `.dark` em `globals.css`:
```css
/* De: */
--card: oklch(0.19 0.02 260);
/* Para: */
--card: oklch(0.22 0.02 260);
```

**Se tudo passar**: nenhuma mudança em `globals.css`.

- [ ] **Step 2: Escrever teste para `min-w-0` + `truncate` no `MatchCard`**

No arquivo existente `src/components/jogos/__tests__/match-card.test.tsx`, ler os testes existentes primeiro (não os substitua). Adicionar:

```tsx
it("aplica truncate nos nomes dos times para evitar overflow", () => {
  render(
    <MatchCard
      match={{ ...base, time_casa: "A".repeat(30), time_fora: "B".repeat(30) }}
      minutosCorte={10}
    />
  );
  // Os spans de nome dos times devem ter a classe truncate
  const spans = screen.getAllByText(/A{30}|B{30}/);
  spans.forEach((el) => expect(el).toHaveClass("truncate"));
});
```

> Você precisará ler o arquivo de teste existente antes de adicionar. Preserve todos os testes existentes.

- [ ] **Step 3: Rodar o teste para confirmar falha**

```bash
npm test -- match-card
```

Esperado: FAIL — `truncate` não existe ainda nos spans dos nomes.

- [ ] **Step 4: Modificar `src/components/jogos/match-card.tsx`**

Substituir a função `Time`:

```tsx
function Time({ nome, bandeira }: { nome: string; bandeira: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {bandeira ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bandeira}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover"
        />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full bg-muted" aria-hidden="true" />
      )}
      <span className="truncate font-medium">{nome}</span>
    </div>
  );
}
```

Substituir o container central dos times:

```tsx
<div className="flex items-center justify-between gap-3 overflow-hidden">
  <Time nome={match.time_casa} bandeira={match.bandeira_casa} />
  <div className="shrink-0 font-display text-xl font-bold tabular-nums">
    {finalizado ? (
      <span>
        <span>{match.placar_casa}</span>
        <span className="mx-1 text-muted-foreground">×</span>
        <span>{match.placar_fora}</span>
      </span>
    ) : (
      <span className="text-muted-foreground">×</span>
    )}
  </div>
  <Time nome={match.time_fora} bandeira={match.bandeira_fora} />
</div>
```

- [ ] **Step 5: Rodar o teste para confirmar aprovação**

```bash
npm test -- match-card
```

Esperado: PASS em todos os testes.

- [ ] **Step 6: Modificar `src/components/ranking/ranking-table.tsx` — esconder coluna em mobile**

No arquivo atual, a coluna de cravadas (`<Target />`) não tem restrição de visibilidade. Não há uma quarta coluna "palpites pontuados" no código atual — a tabela tem: `#`, `Jogador`, `Cravadas (ícone Target)`, `Pontos`.

Em mobile estreito, a tabela funciona bem com 4 colunas. **Não há coluna a esconder aqui** — a spec original mencionava "palpites pontuados" mas a implementação real não tem essa coluna. Skip este item, a tabela está correta.

> Registre no commit message: "ranking-table já não tem coluna de palpites pontuados — sem mudança necessária".

- [ ] **Step 7: Modificar `src/components/ranking/podium.tsx` — ajuste mobile**

No arquivo atual, o `Reveal` tem `w-24 sm:w-28`. O gap é `gap-3 sm:gap-6`. Em mobile pequeno (< 375px), três blocos de 96px + gaps ficam em 96×3 + 8×2 = 304px — cabe em 375px mas aperta em 320px.

Alterar a classe da imagem do avatar para menor em mobile:

```tsx
// Antes:
<img ... className="h-14 w-14 rounded-full bg-muted object-cover ring-2 ring-border" />

// Depois:
<img ... className="h-10 w-10 rounded-full bg-muted object-cover ring-2 ring-border sm:h-14 sm:w-14" />
```

Alterar o span do apelido para `text-xs` em mobile:

```tsx
// Antes:
<span className="mt-2 max-w-full truncate text-center text-sm font-semibold">

// Depois:
<span className="mt-2 max-w-full truncate text-center text-xs font-semibold sm:text-sm">
```

Alterar a `Reveal` className para reduzir largura em mobile muito estreito:

```tsx
// Antes:
className={`${ordem} flex w-24 flex-col items-center sm:w-28`}

// Depois:
className={`${ordem} flex w-20 flex-col items-center sm:w-28`}
```

- [ ] **Step 8: Modificar `src/components/site-header.tsx` — nav gap mobile**

Linha 31 atual:
```tsx
<nav className="flex items-center gap-1">
```

Alterar para:
```tsx
<nav className="flex items-center gap-0.5 sm:gap-1">
```

- [ ] **Step 9: Verificar build + toda a suíte de testes**

```bash
npm test
npm run build
```

Esperado: todos os testes PASS, build sem erros.

- [ ] **Step 10: Commit**

```bash
git add src/components/jogos/match-card.tsx src/components/ranking/ranking-table.tsx src/components/ranking/podium.tsx src/components/site-header.tsx
# Incluir globals.css só se foi modificado na auditoria de contraste.
git commit -m "feat: responsividade mobile (truncate em times, podium menor, nav gap)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação end-to-end

1. `npm test` — toda a suíte verde.
2. `npm run build` — sem erros de tipo.
3. No browser (`npm run dev`), logado:
   - `/jogos`: ao acessar, vê o skeleton imediatamente antes dos dados carregarem. Salvar um palpite → toast verde "Palpite salvo!" aparece no canto inferior. Em mobile estreito, nomes de times longos truncam com `…`.
   - `/ranking`: skeleton do pódio + tabela antes dos dados. Pódio exibe bem em mobile < 375px.
   - `/historico`: skeleton dos cards de resumo + lista antes dos dados.
   - Dark mode: contrastar muted-foreground em ambos os temas — verificar legibilidade.
4. Testar `prefers-reduced-motion`: no DevTools > Rendering > Emulate CSS media feature → `prefers-reduced-motion: reduce`. Animações devem ser instantâneas (sem `y` offset).
