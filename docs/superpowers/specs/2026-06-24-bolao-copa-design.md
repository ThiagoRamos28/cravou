# Cravou! — Bolão da Copa — Design / PRD

- **Nome da aplicação:** Cravou! (referência a "cravar o placar")
- **Pasta do projeto:** `Bolao-TI`
- **Data:** 2026-06-24
- **Status:** Aprovado (design)
- **Contexto temporal:** Copa do Mundo 2026 (EUA/Canadá/México) em andamento — fase de grupos. MVP precisa ficar usável o quanto antes.

## 1. Visão geral

Página web onde um grupo fechado (equipe de TI / amigos) registra palpites para os jogos
da Copa do Mundo. A cada partida finalizada, os palpites são pontuados automaticamente e
um ranking acumulado é atualizado. Design moderno e amigável, com alternância entre modo
escuro e claro.

### Público e escala
- Grupo fechado: dezenas de usuários conhecidos.
- Baixo custo, auth simples, sem necessidade de moderação ou antifraude pesado.

### Objetivos
- Cadastro/login simples.
- Registrar e editar palpites até o corte antes de cada jogo.
- Pontuação automática a partir do resultado real.
- Ranking acumulado com pódio e destaque do usuário.
- Visual moderno, responsivo (mobile-first), dark/light.

### Fora de escopo (YAGNI)
- Gestão de dinheiro/prêmio dentro do app (prêmio é resolvido offline).
- Públicos abertos, antifraude, múltiplos bolões/ligas simultâneos.
- Comentários/chat social.

## 2. Stack

- **Front:** Next.js 15 (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui.
- **Backend/Dados:** Supabase — Auth, Postgres (com RLS), Edge Functions, pg_cron.
- **Fonte de dados:** API-Football (jogos e placares da Copa 2026).
- **Deploy:** Vercel (free tier).
- **Segredos:** chave da API-Football guardada no Supabase (Edge Function), nunca exposta ao browser.

## 3. Arquitetura

```
Next.js (App Router) na Vercel
   ├─ UI (React + Tailwind, dark/light)
   ├─ Server Actions / Route Handlers
   └─ Supabase JS client
            │
Supabase
   ├─ Auth (email/senha + magic link)
   ├─ Postgres (jogos, palpites, perfis, config) + RLS
   ├─ Edge Function "sync-matches" (chama API-Football, grava jogos, finaliza placar, calcula pontos)
   └─ pg_cron (dispara a sync-matches em intervalo)
            │
API-Football (fonte dos jogos/placares da Copa 2026)
```

**Estratégia de integração:** cron agendado (Opção A) como mecanismo principal, com
**fallback manual no painel admin**. A `sync-matches` busca jogos atualizados, grava no
banco e, ao detectar `status = finalizado`, recalcula os pontos dos palpites do jogo.
Quando a API atrasa ou erra, o admin corrige o placar na mão e o recálculo roda igual.

## 4. Modelo de dados (Postgres)

- **profiles** — `id` (FK auth.users), `apelido`, `avatar_url`, `is_admin`, `created_at`
- **matches** — `id`, `api_fixture_id`, `fase` (grupos/oitavas/quartas/semi/final),
  `rodada`, `time_casa`, `time_fora`, `bandeira_casa`, `bandeira_fora`,
  `inicio_em` (timestamptz), `status` (agendado/ao_vivo/finalizado),
  `placar_casa`, `placar_fora`, `placar_manual` (bool — marca override do admin)
- **predictions** — `id`, `user_id`, `match_id`, `palpite_casa`, `palpite_fora`,
  `pontos` (calculado), `created_at`, `updated_at` — UNIQUE(user_id, match_id)
- **app_config** — chave/valor: `minutos_corte` (default 10),
  `pts_placar_exato` (default 10), `pts_resultado` (default 5)

**Ranking:** view que soma `pontos` por usuário, desempate por nº de placares exatos.

## 5. Regras de negócio

- **Pontuação:** placar exato = 10 pts; acertou só o resultado (V/E/D) = 5 pts; errou = 0.
  Valores configuráveis em `app_config`.
- **Corte do palpite:** editável até `inicio_em − minutos_corte` (default 10 min).
  Validado no **servidor** (RLS + server action), nunca apenas no front.
- **Cálculo de pontos:** disparado quando a sync (ou o admin) marca `status = finalizado`;
  recalcula `pontos` de todos os palpites do jogo. Override manual recalcula igual.

## 6. Telas

1. **Login/Cadastro** — email/senha + magic link.
2. **Onboarding** — escolher apelido e avatar (primeiro acesso).
3. **Jogos / Palpites** (home) — lista por fase e dia, filtro por rodada; card com
   times+bandeiras, horário, campos de palpite (travam após o corte) e placar real
   quando finalizado.
4. **Ranking** — pódio + tabela ordenada com avatar/apelido, pontos e nº de cravadas;
   destaca o usuário logado.
5. **Meu histórico** — palpites passados, acertos e pontos por jogo.
6. **Admin** — gerenciar jogos, corrigir placar (fallback manual), rodar sync na mão,
   ajustar config (corte e pontuação).

## 7. Segurança (RLS)

- Cada usuário lê/escreve apenas os **próprios** palpites, e só antes do corte.
- `matches` e ranking: leitura para autenticados; escrita só admin / Edge Function (service role).
- Rotas admin protegidas por flag `is_admin`.

## 8. Design visual

- Marca **Cravou!** no header/título, com identidade divertida e energética.
- Moderno e amigável; **dark/light com toggle persistido**.
- Tema esportivo (verde-campo + cor de acento vibrante), cards arredondados, bandeiras.
- Micro-interações ao salvar palpite; responsivo **mobile-first**.

## 9. Testes

- Unitários da função de pontuação (placar exato / resultado / erro / empate).
- Regra de corte (antes/depois do limite).
- RLS (usuário não edita palpite alheio nem após o corte).

## 10. Roteiro por fases

Cada fase entrega algo verificável e roda no fluxo spec → plano → implementação.

- **Fase 0 — Fundação.** Projeto Next.js + Tailwind + shadcn; projeto Supabase; deploy
  vazio na Vercel; variáveis de ambiente. *Entrega:* app no ar com tela inicial.
- **Fase 1 — Auth & perfil.** Login/cadastro (email/senha + magic link), onboarding de
  apelido/avatar, tabela `profiles` + RLS. *Entrega:* usuário se cadastra e tem perfil.
- **Fase 2 — Ingestão de jogos.** Tabela `matches`, Edge Function `sync-matches`
  (API-Football → banco), pg_cron, e fallback manual de jogos no admin.
  *Entrega:* jogos da Copa aparecem no banco/UI automaticamente.
- **Fase 3 — Palpites.** Tabela `predictions`, tela de jogos com registro/edição de
  palpite, regra de corte validada no servidor. *Entrega:* usuário palpita e edita até o corte.
- **Fase 4 — Pontuação & ranking.** Cálculo de pontos ao finalizar jogo (sync + override
  admin), view de ranking, tela de ranking com pódio. *Entrega:* pontos somam e ranking ordena.
- **Fase 5 — Histórico & navegação.** Tela "meu histórico", visão por fase/rodada com
  filtros. *Entrega:* usuário acompanha seu desempenho ao longo da Copa.
- **Fase 6 — Polimento visual.** Dark/light refinado, responsividade, micro-interações,
  estados vazios/carregando. *Entrega:* visual final coeso.
- **Fase 7 — Testes & robustez.** Testes de pontuação, corte e RLS; tratamento de erros
  da API; admin de configuração. *Entrega:* MVP confiável.

**Ordem de prioridade dado que a Copa já começou:** Fases 0→4 formam o MVP mínimo jogável
(cadastrar, palpitar, pontuar, rankear). Fases 5–7 entram em seguida sem bloquear o uso.
