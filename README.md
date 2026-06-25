# Cravou! ⚽

Bolão da Copa do Mundo 2026 para grupos fechados. Registre palpites, pontue automaticamente e acompanhe o ranking em tempo real.

**Demo:** [cravou-iota.vercel.app](https://cravou-iota.vercel.app)

---

## Funcionalidades

- **Palpites** — registre e edite o placar esperado até o corte configurável (padrão 10 min antes do jogo)
- **Pontuação automática** — placar exato (10 pts), saldo+vencedor (7), resultado V/E/D (5), gols de um time (2) — valores configuráveis pelo admin
- **Ranking ao vivo** — pódio animado + tabela completa com pontuação acumulada
- **Meu histórico** — resumo pessoal (total de pontos, cravadas, aproveitamento) e lista detalhada por jogo
- **Filtros por fase/rodada** — navegue entre grupos, oitavas, quartas, semi e final
- **Painel admin** — sincronização manual com a API, correção de placar e configuração de pontuação
- **Sincronização automática** — Edge Function com retry (3×, backoff exponencial) e timeout de 15s
- **Auth completo** — login via magic link (Supabase Auth), onboarding de perfil, proteção por RLS

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilo | Tailwind CSS v4 (tokens oklch, dark/light mode) |
| Animações | Framer Motion (respeitando `prefers-reduced-motion`) |
| Backend | Supabase — Postgres + RLS + Edge Functions + pg_cron |
| Auth | Supabase Auth (magic link) |
| Testes | Vitest + React Testing Library (75 testes) + pgTAP (RLS) |
| Deploy | Vercel (CI automático no push para `master`) |

## Rodando localmente

### Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com) (projeto criado)

### Setup

```bash
git clone https://github.com/ThiagoRamos28/cravou
cd cravou
npm install
```

Crie `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

```bash
npm run dev   # http://localhost:3000
```

### Comandos disponíveis

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção (inclui type-check)
npm run lint       # ESLint
npm test           # Vitest (run único)
npm run test:watch # Vitest em modo watch
```

## Estrutura do projeto

```
src/
  app/
    layout.tsx          # fontes, ThemeProvider, metadata
    page.tsx            # landing page
    globals.css         # tokens de tema (oklch) + @theme inline
    jogos/              # listagem de jogos com filtros de fase/rodada
    ranking/            # pódio + tabela de ranking
    historico/          # histórico pessoal com resumo
    admin/              # painel admin (sync, config de pontuação)
    entrar/             # login com magic link
    onboarding/         # cadastro de nome de exibição
  components/
    ui/                 # Button, Toast, Skeleton
    jogos/              # MatchCard, PalpiteForm, JogosFiltro
    ranking/            # PodiumCard, RankingTable
    historico/          # Resumo, HistoricoItem
    admin/              # MatchAdminRow, ConfigForm
    motion/             # Reveal (entrada animada)
  lib/
    supabase/           # client (browser) + server (SSR)
    matches.ts          # listarJogos (com filtro fase/rodada)
    predictions.ts      # listarMeusPalpites, submeterPalpite
    ranking.ts          # listarRanking
    historico.ts        # resumoHistorico
    config.ts           # listarConfig, salvarConfig
    auth/               # getSessao, requireAdmin
supabase/
  migrations/           # schema completo (0001–0008)
  functions/
    sync-matches/       # Edge Function de sincronização
    _shared/            # fixtures.ts (mappers FlashScore → MatchRow)
```

## Regras de pontuação

| Acerto | Pontos (default) |
|--------|-----------------|
| Placar exato (casa e fora corretos) | 10 |
| Saldo + vencedor (diferença de gols exata) | 7 |
| Resultado V/E/D | 5 |
| Gols de um time | 2 |
| Erro total | 0 |

Todos os valores são configuráveis pelo admin em `/admin/config`. Quando alterados, todos os pontos são recalculados automaticamente.

## Segurança

- **RLS (Row Level Security)** em todas as tabelas — usuários só acessam os próprios palpites
- **Segredos no servidor** — chaves de API e service role nunca chegam ao browser
- **Corte de palpite** validado no servidor (não apenas no client)
- **Admin check** via `is_admin` no perfil, verificado em server actions e middleware

## Licença

MIT
