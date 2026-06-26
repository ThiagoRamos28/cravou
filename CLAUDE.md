@AGENTS.md

# Cravou! — Bolão da Copa

Página web onde um grupo fechado (equipe de TI / amigos) registra palpites para os jogos
da Copa do Mundo 2026. A cada partida finalizada, os palpites são pontuados
automaticamente e um ranking acumulado é atualizado.

- **Nome de exibição:** `Cravou!` (sempre com ponto de exclamação, verbatim).
- **Idioma da UI:** Português do Brasil.
- **Produção:** https://cravou-iota.vercel.app/ · **Repo:** github.com/ThiagoRamos28/cravou
- **Spec/PRD:** [docs/superpowers/specs/2026-06-24-bolao-copa-design.md](docs/superpowers/specs/2026-06-24-bolao-copa-design.md)
- **Planos por fase:** [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

- **Next.js 16** (App Router) + TypeScript — ⚠️ veja `AGENTS.md`: esta versão tem breaking
  changes; consulte `node_modules/next/dist/docs/` antes de usar APIs do Next.
- **Tailwind CSS v4** (config via `@theme inline` em `src/app/globals.css`, sem `tailwind.config`).
- **next-themes** para dark/light (`attribute="class"`, `defaultTheme="system"`).
- **Framer Motion** para animações (sempre respeitar `prefers-reduced-motion`).
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — Auth, Postgres + RLS, Edge Functions, pg_cron.
- **Vitest** + React Testing Library para testes.
- **lucide-react** para ícones (nunca emojis como ícones).
- Deploy: **Vercel** (deploy automático no push para `master`).

## Comandos

```bash
npm run dev        # servidor de desenvolvimento (localhost:3000)
npm run build      # build de produção (roda type-check)
npm run lint       # eslint
npm test           # vitest (run único)
npm run test:watch # vitest em watch
```

## Estrutura

```
src/
  app/
    layout.tsx        # fontes (Barlow/Barlow Condensed/Geist Mono), ThemeProvider, metadata
    page.tsx          # landing (compõe Hero + Features + CtaSection)
    globals.css       # tokens de tema (oklch) + @theme inline + dark por classe
  components/
    ui/button.tsx     # Button + buttonVariants() — reutilizável (variantes: primary/cta/outline/ghost)
    motion/reveal.tsx # Reveal — entrada animada com Framer Motion (reduced-motion aware)
    theme-provider.tsx, theme-toggle.tsx
    site-header.tsx, site-footer.tsx
    landing/          # hero.tsx, features.tsx, cta-section.tsx
    __tests__/        # testes co-localizados por componente
  lib/
    supabase/
      client.ts       # createClient() para o browser (createBrowserClient)
      server.ts       # createClient() para server components/actions (createServerClient + cookies)
```

## Design system

- **Tipografia:** Barlow Condensed (display/títulos, `font-display`, uppercase) + Barlow (corpo, `font-sans`).
- **Cores:** verde-campo = `primary`; laranja energético = `accent` (CTA/destaque). Tokens em
  oklch definidos em `:root` e `.dark` no `globals.css`, mapeados em `@theme inline` como
  `--color-*` → utilitários `bg-primary`, `text-accent`, `border-border`, `bg-muted`, etc.
- **Componentes novos** devem reusar `Button`/`buttonVariants()` e `Reveal`, e funcionar em
  ambos os temas (testar dark E light).
- Checklist UI: `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1, transições
  150–300ms, responsivo mobile-first, ícones SVG (lucide).

## Convenções

- TDD: escreva o teste primeiro, veja falhar, implemente, veja passar, commit (um commit por unidade).
- Componentes com hooks/Framer Motion precisam de `"use client"`.
- `ease` de cubic-bezier no Framer Motion precisa de `as const` (tupla) por causa da tipagem.
- Segredos nunca no client: só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  são expostos ao browser. Service role / API-Football só em Edge Functions. `.env.local` é git-ignored.
- Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Roadmap (fases)

Fase 0 ✅ Fundação (scaffold, tema, landing, Supabase wiring, deploy). Próximas: Fase 1 Auth &
perfil · Fase 2 Ingestão de jogos (API-Football + cron) · Fase 3 Palpites · Fase 4 Pontuação &
ranking · Fase 5 Histórico & navegação · Fase 6 Polimento · Fase 7 Testes & robustez.
Cada fase tem seu próprio plano em `docs/superpowers/plans/`.

## Protocolo de encerramento de tarefas

Ao finalizar uma branch/feature com `superpowers:finishing-a-development-branch`:

1. Verificar que os testes passam (`npm test`).
2. Push para `master` (Vercel faz deploy automático).
3. **Registrar no Obsidian Vault** — documentar o que foi entregue (feature, decisões relevantes, variáveis de ambiente novas, etc.).

## Regras de negócio (resumo)

- Pontuação: placar exato = 10 pts; só o resultado (V/E/D) = 5 pts; erro = 0 (configurável em `app_config`).
- Corte do palpite: editável até `inicio_em − minutos_corte` (default 10 min), validado no servidor.
- Resultados: sync automática da API-Football (cron) como principal; admin corrige placar manualmente como fallback.
