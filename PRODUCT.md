# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Grupo fechado de amigos e colegas de equipe de TI que participam de um bolão de palpites
para a Copa do Mundo 2026 (e, mais recentemente, também para o Brasileirão). Não é um produto
de cadastro público: o acesso é por login (Supabase Auth) dentro de um grupo já conhecido.

## Product Purpose

Registrar os palpites de cada participante para os jogos das competições acompanhadas
(placar exato por partida) e, a cada jogo finalizado, pontuar automaticamente os palpites e
manter um ranking acumulado — geral e por temporada/mês — para que o grupo veja quem está
ganhando o bolão.

## Positioning

Um bolão informal entre amigos, não uma plataforma de apostas ou fantasy game comercial: sem
dinheiro envolvido, sem usuários anônimos, com a pontuação e o corte de palpites decididos e
ajustáveis pelo próprio grupo (via `app_config`). O diferencial é a automação: sync automático
de resultados (API-Football/FlashScore via Edge Functions + pg_cron) e pontuação recalculada
sem intervenção manual na maioria dos casos, com fallback de correção manual pelo admin.

## Operating Context

- Cada competição (Copa do Mundo, Brasileirão) tem suas próprias partidas, temporadas/meses e
  ranking.
- Palpites podem ser editados até um corte configurável antes do início do jogo
  (`inicio_em − minutos_corte`, validado no servidor).
- Resultados chegam por sincronização automática (cron) como fonte principal; o admin corrige
  placar manualmente como fallback quando a sync falha ou demora.
- Jogos de mata-mata podem ir para prorrogação/pênaltis; a pontuação sempre considera o placar
  dos 90 minutos regulamentares.
- Todo horário exibido ao usuário é em `America/Sao_Paulo` (BRT).
- Fuso e regras de corte/pontuação são regras de negócio que o grupo pode reconfigurar
  (`app_config`), não constantes fixas de produto.

## Capabilities and Constraints

- Autenticação via Supabase Auth (link mágico por e-mail); sem cadastro self-service aberto ao
  público.
- Palpite = placar exato previsto para uma partida. Pontuação: placar exato = 10 pts, só o
  resultado (V/E/D) = 5 pts, erro = 0 (valores configuráveis).
- Ranking com desempate em cascata (critérios definidos em `ranking-shared.ts`), calculado por
  competição e por período (geral, temporada, mês).
- Sync de partidas e resultados roda via Edge Functions + pg_cron; segredos de API
  (service role, API-Football) nunca chegam ao client — só chave pública Supabase é exposta.
- Painel de admin permite corrigir placares manualmente quando a sync automática falha.
- Stack fixa do projeto: Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Supabase
  (Postgres + RLS + Auth + Edge Functions), Framer Motion, Vitest. Ver detalhes em `CLAUDE.md`.

## Brand Commitments

- Nome de exibição: `Cravou!` — sempre com ponto de exclamação, verbatim, nunca abreviado ou
  sem a exclamação.
- Idioma da interface: português do Brasil.
- Sistema de cores e tipografia já estabelecido no código (não redefinir do zero): verde-campo
  como `primary`, laranja energético como `accent` (CTA/destaque), tokens em oklch definidos em
  `src/app/globals.css` (`:root` e `.dark`), tipografia Barlow Condensed (display/títulos,
  uppercase) + Barlow (corpo). Suporte a dark e light via `next-themes` é obrigatório em toda
  UI nova.
- Ícones sempre SVG via `lucide-react`; nunca emojis como ícone de interface.

## Evidence on Hand

- Produto em produção: https://cravou-iota.vercel.app/
- Specs e planos de cada fase documentados em `docs/superpowers/specs/` e
  `docs/superpowers/plans/`.
- Estado atual do trabalho (frentes abertas, pendências, dívidas técnicas conhecidas) está em
  `NEXT_STEPS.md`, atualizado a cada sessão — consultar antes de assumir o que já está pronto.

## Product Principles

- Automação como padrão, correção manual como fallback: sync e pontuação devem funcionar
  sozinhas; intervenção humana é para os casos em que a automação falhou, não o caminho normal.
- Regras de negócio (pontuação, corte, fuso) são configuráveis pelo grupo, não hardcoded como
  verdade absoluta — mas mudanças de configuração exigem ação explícita documentada (ver dívida
  técnica sobre `app_config` ser global).
- Transparência de ranking: o grupo precisa conseguir entender por que alguém está na frente
  (critérios de desempate visíveis em `/regras`), não só ver um número.
- Consistência de fuso: toda exibição de data/hora ao usuário é em horário de Brasília, sem
  exceção.

## Accessibility & Inclusion

Nenhum requisito específico de acessibilidade foi estabelecido além do padrão do design system
existente (contraste ≥ 4.5:1, foco visível, responsivo mobile-first — ver checklist de UI no
CLAUDE.md).
