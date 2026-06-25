# Cravou! — Fase 6 — Polimento Visual — Design / Spec

- **Data:** 2026-06-25
- **Status:** Aprovado (design)
- **Contexto:** Fases 0–5 completas e no ar. Copa do Mundo 2026 em andamento (fase de grupos). Esta fase traz a camada de polimento visual que transforma o MVP funcional em produto coeso.

## 1. Objetivo

Três frentes independentes de polimento:

1. **Feedback ao salvar palpite** — toast flutuante + animação no card ao confirmar ou errar o palpite.
2. **Skeletons de carregamento** — placeholders animados nas páginas internas enquanto os dados chegam do servidor.
3. **Dark/light + responsividade** — auditoria de contraste e ajustes de layout em mobile pequeno.

Cada frente é independente e pode ser implementada e revisada separadamente.

---

## 2. Frente 1 — Feedback ao salvar palpite

### 2.1 Toast system

**Arquivos:**
- `src/components/ui/toast.tsx` — contexto + hook `useToast()`
- `src/components/ui/toaster.tsx` — renderer global com `AnimatePresence`

**Comportamento:**
- `ToastProvider` envolve o `<body>` em `src/app/layout.tsx` (acima de `ThemeProvider`).
- Hook: `const { toast } = useToast()` expõe `toast({ message: string, variant: "success" | "error" })`.
- O `Toaster` renderiza toasts fixos no canto inferior-direito da viewport (`fixed bottom-4 right-4 z-50`). Em mobile (`< sm`): `bottom-4 left-4 right-4` (largura total).
- Cada toast: ícone lucide (`CheckCircle` para success, `XCircle` para error) + mensagem. Fundo `bg-card`, borda `border-border`, sombra leve. Texto `text-foreground`. Variante success: ícone `text-primary`. Variante error: ícone `text-red-500 dark:text-red-400`.
- Entrada: `motion.div` com `initial={{ opacity: 0, y: 16 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.25 }}`.
- Saída: `exit={{ opacity: 0, y: 8 }}`, `transition={{ duration: 0.15 }}`.
- Auto-dismiss: `setTimeout` de **4000 ms** após montar.
- `aria-live="polite"` no container do `Toaster` para acessibilidade.
- Usa `useReducedMotion()`: se ativo, `initial`/`exit` sem `y` (só opacity).
- Máximo de **3 toasts** visíveis simultaneamente; o mais antigo sai primeiro.

**Mensagens:**
- Sucesso: `"Palpite salvo!"`
- Erro (corte passado): `"Palpites encerrados para este jogo."`
- Erro genérico: o texto de `estado.erro` (vindo da Server Action).

### 2.2 Integração em `PalpiteForm`

**Arquivo:** `src/components/jogos/palpite-form.tsx`

- Chama `useToast()` e dispara `toast(...)` dentro de um `useEffect` que observa `estado.ok` / `estado.erro`.
- Quando `estado.ok` muda para truthy: `toast({ message: "Palpite salvo!", variant: "success" })`.
- Quando `estado.erro` muda para truthy: `toast({ message: estado.erro, variant: "error" })`.
- Ao detectar `estado.ok`, exibe brevemente uma linha `"Palpite salvo!"` inline no form com `motion.div` (fade-in 200 ms, auto-some em 2 s) — reforço contextual além do toast.

### 2.3 Animação do estado "travado"

Ainda em `PalpiteForm`, quando o formulário passa de aberto → travado:

- O bloco de "palpites encerrados" (`<div className="mt-3">`) vira `motion.div` com `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.3 }}`.
- O badge de pontos ("Cravou! +N pts" ou "+N pts") tem a mesma animação com `delay: 0.1`.
- `AnimatePresence` gerencia a troca entre o estado de form aberto e o estado travado; nenhuma mudança na lógica condicional existente.
- `useReducedMotion()`: se ativo, sem offset `y`.

**Testes:** atualizar `palpite-form.test.tsx` para cobrir: (a) `useToast` é chamado com `"Palpite salvo!"` quando `estado.ok` está presente; (b) mensagem de erro chama `toast` com `variant: "error"`.

---

## 3. Frente 2 — Skeletons de carregamento

### 3.1 Primitivo

**Arquivo:** `src/components/ui/skeleton.tsx`

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}
```

Sem Framer Motion — `animate-pulse` CSS é suficiente e mais leve. A regra global `prefers-reduced-motion` em `globals.css` já zera `animation-duration`, então o skeleton simplesmente fica estático sem piscar.

### 3.2 `loading.tsx` por página

Next.js 16 detecta `loading.tsx` co-localizado com `page.tsx` e envolve automaticamente o conteúdo em `<Suspense>`.

**`src/app/jogos/loading.tsx`:**
- `SiteHeader` real (já é server component leve, não precisa skeleton).
- `<main>` com `max-w-3xl`: título skeleton (`h-8 w-40`), linha de chips de filtro (`h-8 w-full max-w-sm`), depois 5 repetições do MatchCard skeleton:
  - `rounded-2xl border border-border bg-card p-4`: linha de data + status (`h-3 w-24`), linha central com dois times + placar (dois blocos `h-6 w-24` + `h-7 w-12` no meio), linha de palpite (`h-9 w-48`).

**`src/app/ranking/loading.tsx`:**
- `<main>` com `max-w-2xl`: título skeleton, pódio (3 blocos `rounded-2xl` de alturas escalonadas: 80 px / 96 px / 72 px), depois 5 linhas de tabela skeleton (posição + avatar + nome + pontos + cravadas).

**`src/app/historico/loading.tsx`:**
- `<main>` com `max-w-2xl`: título skeleton, 3 cards de resumo side-by-side (`grid grid-cols-3 gap-3`), depois 5 itens de lista skeleton (data + times + palpite + badge de pontos).

Todos usam `SiteHeader` real (não skeleton) pois o header é leve e já existe em cache.

---

## 4. Frente 3 — Dark/light + Responsividade

### 4.1 Auditoria de contraste

Verificar `muted-foreground` (`oklch(0.45)` light, `oklch(0.72)` dark) contra `background` e `card`. Se algum valor ficar abaixo de **4.5:1** (WCAG AA para texto normal), elevar a luminosidade no token em `globals.css`. Usar [APCA ou WCAG contrast checker](https://oklch.com) para aferir.

### 4.2 `MatchCard` — overflow em mobile estreito

**Arquivo:** `src/components/jogos/match-card.tsx`

- Componente `Time`: adicionar `min-w-0` no container e `truncate` no `<span>` do nome. Garante que nomes longos ("Arábia Saudita") não quebrem o layout.
- `<div className="flex items-center justify-between gap-3">`: adicionar `overflow-hidden` para conter o `truncate`.

### 4.3 `Podium` — mobile

**Arquivo:** `src/components/ranking/podium.tsx`

- Reduzir padding e font-size dos blocos em mobile: `text-xs` nos nomes e apelidos em `< sm`, `px-2` nos blocos.
- Se os três blocos ficarem muito comprimidos em `< 360px`, empilhar verticalmente com `flex-col sm:flex-row` e reordenar (1º no topo, 2º e 3º abaixo).

### 4.4 `RankingTable` — coluna extra em mobile

**Arquivo:** `src/components/ranking/ranking-table.tsx`

- Coluna "Palpites pontuados": `hidden sm:table-cell` na `<th>` e em cada `<td>` correspondente. Em mobile, mostra só: posição, apelido, pontos, cravadas.

### 4.5 Header — nav em mobile

**Arquivo:** `src/components/site-header.tsx`

- Reduzir `gap-1` para `gap-0.5` entre os links no nav em mobile.
- Links: `text-sm` já é pequeno; se precisar, adicionar `hidden xs:inline` para o texto e manter o link clicável — mas só se o tester confirmar overflow real em `< 375px`.

### 4.6 Dark mode — distinção card vs background

Se `bg-card` (`oklch(0.19)`) não for suficientemente distinguível de `bg-background` (`oklch(0.15)`) na prática (depende do monitor), elevar `--card` no `.dark` para `oklch(0.21 0.02 260)`.

---

## 5. Fora de escopo (YAGNI)

- Animações de entrada nas páginas de ranking/histórico (já têm `Reveal` no pódio; adicionar mais seria excessivo).
- Skeleton no header ou footer.
- Animação "ao vivo" no card de jogo com status `ao_vivo` (Copa 2026 não tem jogos simultâneos relevantes agora).
- Toast com fila persistente ou histórico de notificações.
- Refactor estrutural de qualquer componente.

---

## 6. Convenções e restrições

- Framer Motion: `ease` como tupla `as const`, `useReducedMotion()` sempre.
- Tailwind v4: tokens via `@theme inline` em `globals.css`; sem `tailwind.config`.
- Componentes com hooks ou Framer Motion: `"use client"`.
- TDD: teste primeiro, falha, implementa, passa, commit por unidade.
- Mensagens de commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Ícones: lucide-react (nunca emoji).
- `cursor-pointer` em clicáveis; contraste ≥ 4.5:1; transições 150–300 ms.
