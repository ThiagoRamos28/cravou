# Modal de Novidades do Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir um modal uma única vez em `/jogos` informando que o usuário pode alterar avatar, apelido e senha pelo perfil, com opção de não mostrar mais.

**Architecture:** Um único client component `NovidadesModal` que checa `localStorage` no `useEffect` e exibe o modal com Framer Motion se a flag ainda não estiver marcada. Sem testes automatizados (lógica trivial de localStorage + booleano).

**Tech Stack:** Next.js 16 App Router, TypeScript, Framer Motion, Tailwind CSS v4, lucide-react.

## Global Constraints

- Idioma da UI: Português do Brasil.
- Ícones: `lucide-react` — nunca emojis.
- Framer Motion: respeitar `prefers-reduced-motion` via `useReducedMotion()` — zerar `duration` quando ativo.
- Componentes com hooks: `"use client"`.
- `localStorage` key: `"cravou:novidades-perfil-v1"` — exato, verbatim.
- Commit messages terminam com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/components/novidades-modal.tsx` | Criar | Client component completo — estado, handlers, UI |
| `src/app/jogos/page.tsx` | Modificar | Adicionar import + `<NovidadesModal />` |

---

## Task 1: `NovidadesModal` + wiring em `/jogos`

**Files:**
- Create: `src/components/novidades-modal.tsx`
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Produces: `NovidadesModal()` — exportação nomeada, sem props
- Consumes: `Button` de `@/components/ui/button`, `Sparkles` de `lucide-react`, `motion`/`AnimatePresence`/`useReducedMotion` de `framer-motion`, `useRouter` de `next/navigation`

*Sem testes automatizados — verificação via build check + inspeção manual no browser.*

- [ ] **Step 1: Criar `src/components/novidades-modal.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cravou:novidades-perfil-v1";

function marcarVisto() {
  localStorage.setItem(STORAGE_KEY, "visto");
}

export function NovidadesModal() {
  const [visivel, setVisivel] = useState(false);
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "visto") {
      setVisivel(true);
    }
  }, []);

  function handleIrPerfil() {
    marcarVisto();
    router.push("/perfil");
  }

  function handleFechar() {
    marcarVisto();
    setVisivel(false);
  }

  function handleOverlay() {
    setVisivel(false);
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={handleOverlay}
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <h2 className="mb-2 text-center font-display text-xl font-bold uppercase tracking-tight">
              Novidade no Cravou!
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Agora você pode alterar seu avatar, apelido e senha acessando o
              seu perfil de usuário.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="cta"
                className="w-full"
                onClick={handleIrPerfil}
              >
                Ir para o Perfil
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleFechar}
              >
                Entendi
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Adicionar `NovidadesModal` em `src/app/jogos/page.tsx`**

Adicione o import no topo do arquivo (após os imports existentes):

```tsx
import { NovidadesModal } from "@/components/novidades-modal";
```

No JSX, adicione `<NovidadesModal />` logo após `<SiteHeader />`:

```tsx
return (
  <div className="flex min-h-dvh flex-col bg-background text-foreground">
    <SiteHeader />
    <NovidadesModal />
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      {/* ... conteúdo existente mantido ... */}
    </main>
    <SiteFooter />
  </div>
);
```

- [ ] **Step 3: Verificar o build**

```bash
npm run build 2>&1 | tail -10
```

Esperado: build sem erros de tipo, `/jogos` compilado normalmente.

- [ ] **Step 4: Verificar manualmente no browser**

```bash
npm run dev
```

1. Abra `http://localhost:3000/jogos` com usuário logado
2. Modal deve aparecer com animação de entrada
3. Clicar "Entendi" → modal fecha + localStorage tem a flag
4. Recarregar a página → modal NÃO reaparece
5. Remover a flag no DevTools (`localStorage.removeItem("cravou:novidades-perfil-v1")`) e recarregar → modal reaparece
6. Clicar "Ir para o Perfil" → salva flag + navega para `/perfil`
7. Clicar fora do card (no overlay) → modal fecha SEM salvar a flag

- [ ] **Step 5: Rodar a suite de testes**

```bash
npm test
```

Esperado: 136/136 passing (nenhum teste quebrado pelo novo componente).

- [ ] **Step 6: Commit**

```bash
git add src/components/novidades-modal.tsx src/app/jogos/page.tsx
git commit -m "feat: modal de novidades do perfil com localStorage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
