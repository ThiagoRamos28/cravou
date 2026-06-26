# Visual & UX Adjustments — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 6 problemas visuais e de UX identificados pelo usuário, sem novas libs e sem alterações de banco.

**Branch:** `feat/visual-ux-adjustments`

**Data:** 2026-06-26

---

## Global Constraints

- Next.js 16 App Router + TypeScript — consultar `node_modules/next/dist/docs/` antes de usar APIs novas.
- Tailwind CSS v4 com `@theme inline` em `globals.css` — sem `tailwind.config`.
- Componentes com hooks ou Framer Motion precisam de `"use client"`.
- UI: `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1, dark E light mode.
- Ícones: lucide-react. Nunca emojis como ícones.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- TDD: escrever teste primeiro, ver falhar, implementar, ver passar, commitar.

---

## Item 1 — Nomes de países em PT + fuso Brasília

### Problema
- Nomes dos países vêm da API em inglês (ex: "Brazil", "France").
- `toLocaleString("pt-BR")` sem `timeZone` usa o fuso do servidor/browser.

### Solução
- Criar `src/lib/i18n/paises.ts` com mapeamento estático `Record<string, string>` (inglês → português).
- Exportar função `traduzirPais(nome: string): string` — retorna tradução ou o original se não encontrado.
- Em `match-card.tsx`, aplicar `traduzirPais()` em `time_casa` e `time_fora`.
- Adicionar `timeZone: "America/Sao_Paulo"` no `toLocaleString`.

### Arquivos
- **Criar:** `src/lib/i18n/paises.ts`
- **Modificar:** `src/components/jogos/match-card.tsx` (linha 41–46)
- **Criar:** `src/lib/i18n/__tests__/paises.test.ts`

---

## Item 2 — Layout simétrico do card (flags no centro)

### Problema
Ambos os times usam `flex gap-2 items-center` com flag à esquerda e nome à direita. O time da casa fica left-aligned, assimétrico visualmente.

### Solução
Adicionar prop `lado: "casa" | "fora"` ao componente interno `Time` em `match-card.tsx`:
- `lado="casa"`: `flex items-center justify-end gap-2` — nome à esquerda, flag à direita (flag próxima ao ×).
- `lado="fora"`: layout atual — flag à esquerda, nome à direita.

Resultado visual: `Senegal 🇸🇳 × 🇮🇶 Iraque`

### Arquivos
- **Modificar:** `src/components/jogos/match-card.tsx`
- **Modificar:** `src/components/jogos/__tests__/match-card.test.tsx` (verificar renderização simétrica)

---

## Item 3 — Destaque de palpite no dark mode

### Problema
Quando o jogo encerra e o usuário tem palpite, o texto "Palpites encerrados: X × Y" usa `text-muted-foreground`, que some no dark mode.

### Solução
Em `palpite-form.tsx`:
- Quando `palpite` existe (usuário palpitou): trocar `text-muted-foreground` por `text-foreground` no span de "Palpites encerrados: X × Y".
- Quando não tem palpite: manter `text-muted-foreground` (comportamento atual).

Em `match-card.tsx`:
- Quando `palpite` é passado como prop, adicionar `border-primary/40` ao `article` (sobre o `border-border` padrão), para destaque visual imediato na lista.

### Arquivos
- **Modificar:** `src/components/jogos/palpite-form.tsx` (linha 57)
- **Modificar:** `src/components/jogos/match-card.tsx` (linha 49, className do `article`)

---

## Item 4 — Filtro "Palpitar agora"

### Problema
Usuário precisa rolar a lista inteira de jogos para encontrar os que ainda aceitam palpite.

### Solução
- `listarJogos` em `src/lib/matches.ts` recebe parâmetros opcionais `soAbertos?: boolean`, `minutosCorte?: number` e `limite?: number`.
  - Quando `soAbertos=true`, aplica `.filter()` em JS sobre o resultado usando a função `palpiteAberto(inicio_em, minutosCorte)` já existente em `src/lib/palpites/corte.ts`.
  - `limite` restringe o array retornado (para o uso no landing: máximo 6).
  - Preferir filtro em JS para reutilizar a lógica já validada de `palpiteAberto`.
- `JogosFiltro` em `src/components/jogos/jogos-filtro.tsx` ganha um chip/toggle "Palpitar agora" independente dos filtros de fase/rodada.
  - Quando ativo, adiciona `soAbertos=1` à URL.
  - Quando inativo, remove o param.
- `jogos/page.tsx` lê `soAbertos` de `searchParams` e passa para `listarJogos`.

### Arquivos
- **Modificar:** `src/lib/matches.ts`
- **Modificar:** `src/components/jogos/jogos-filtro.tsx`
- **Modificar:** `src/app/jogos/page.tsx`

---

## Item 5 — Botão "Esqueci a senha"

### Problema
Não existe fluxo de recuperação de senha. Usuário que esqueceu a senha não tem caminho (além do magic link).

### Solução

**`auth-form.tsx`:**
- Na aba "Entrar", adicionar link `"Esqueci a senha"` abaixo do input de senha.
- Clicar alterna o form para modo `"recuperar"` (estado local `modo: "entrar" | "recuperar"`).
- No modo recuperar: exibe apenas campo e-mail + botão "Enviar link de redefinição" + link "Voltar".

**`src/app/entrar/actions.ts`:**
- Nova action `solicitarRedefinicaoSenha(_prev, formData)` que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: "<origin>/redefinir-senha" })`.
- Retorna `{ ok }` ou `{ erro }`.

**`src/app/redefinir-senha/page.tsx`** (novo):
- Server component que verifica se há sessão ativa (Supabase coloca o usuário em sessão após clicar no link de reset).
- Se sem sessão: redireciona para `/entrar`.
- Exibe form com campo "Nova senha" + confirmar senha.
- Action `redefinirSenha` chama `supabase.auth.updateUser({ password })`.
- Sucesso: redireciona para `/jogos`.

**`src/app/auth/callback/route.ts`:**
- O callback já existe e está corrigido (segurança). O link de reset do Supabase usa o mesmo fluxo PKCE — `redirectTo` deve apontar para `/redefinir-senha` diretamente (sem passar pelo `/auth/callback`), ou passar com `next=/redefinir-senha`. Usar a opção mais simples: `redirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/redefinir-senha"`.

### Arquivos
- **Modificar:** `src/components/auth/auth-form.tsx`
- **Modificar:** `src/app/entrar/actions.ts`
- **Criar:** `src/app/redefinir-senha/page.tsx`

---

## Item 6 — Landing page dinâmica

### Problema
- Botão "Começar a palpitar" no hero sempre aponta para `/entrar` — usuário logado entra em loop (entrar → onboarding → index).
- Landing page é estática e não mostra o que o bolão tem de conteúdo.

### Solução

**`src/app/page.tsx`:**
- É server component — pode verificar sessão e buscar dados.
- Chamar `getSessao()`, `getMinutosCorte()` e `listarJogos({ soAbertos: true, minutosCorte, limite: 6 })` (reutiliza o filtro do item 4).
- Passar `logado` para `Hero` e para `CtaSection` (já tem a prop).
- Renderizar `<ProximosJogos jogos={...} logado={logado} />` entre `<Hero>` e `<Features>`.

**`src/components/landing/hero.tsx`:**
- Receber prop `logado: boolean`.
- Botão "Começar a palpitar": `href={logado ? "/jogos" : "/entrar"}`.
- Label quando logado: "Ver os jogos".

**`src/components/landing/proximos-jogos.tsx`** (novo):
- Componente server-renderable (sem `"use client"`).
- Exibe até 6 jogos como cards compactos (data, times, status).
- Se logado: link "Ver todos" → `/jogos`. Se não logado: CTA "Entre para palpitar" → `/entrar`.
- Usa `traduzirPais()` e fuso Brasília (reutiliza lógica do item 1).
- Se não há jogos próximos: não renderiza a seção (retorna `null`).

### Arquivos
- **Modificar:** `src/app/page.tsx`
- **Modificar:** `src/components/landing/hero.tsx`
- **Criar:** `src/components/landing/proximos-jogos.tsx`

---

## Ordem de implementação recomendada

1. `paises.ts` + teste (base para items 1 e 6)
2. `match-card.tsx` (items 1, 2 e 3 juntos — mesmo arquivo)
3. `palpite-form.tsx` (item 3)
4. `matches.ts` + `jogos-filtro.tsx` + `jogos/page.tsx` (item 4)
5. `auth-form.tsx` + `actions.ts` + `redefinir-senha/page.tsx` (item 5)
6. `page.tsx` + `hero.tsx` + `proximos-jogos.tsx` (item 6)

## Testes esperados

- `paises.test.ts`: `traduzirPais("Brazil")` → `"Brasil"`, `traduzirPais("Unknown")` → `"Unknown"`.
- `match-card.test.tsx`: flag do time da casa renderiza à direita do nome; flag do visitante à esquerda.
- Testes existentes devem continuar passando sem alteração.
