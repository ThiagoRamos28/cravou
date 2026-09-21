# Sugestões de placar via Telegram — plano

**Objetivo:** 2h antes de cada jogo, enviar ao admin (Thiago) no Telegram 3 sugestões de placar
calculadas estatisticamente. Uso pessoal — nada aparece na UI do Cravou!.

## Arquitetura

```
pg_cron '5,20,35,50 * * * *'  (5 min depois do sync-matches, que captura as odds 2h antes)
  └─> Edge Function `sugerir-placares` (x-cron-secret)
        1. jogos `agendado` com inicio_em ∈ (agora, agora+2h] sem linha em `sugestoes_placar`
           (odds ainda ausentes e jogo a >75 min → espera a próxima run)
        2. 1 chamada FlashScore por jogo: matches/h2h?grouped=true
           (forma dos dois times + confronto direto)
        3. modelo (_shared/palpite-modelo.ts, puro/testado):
           - λ das odds: 1x2 sem margem + over/under 2.5 → busca em grade por (λc, λf)
           - λ da forma: últimos 10 jogos (gols pró/contra de cada lado)
           - mistura 70% odds / 30% forma (só forma se não houver odds)
           - matriz Poisson 0..7 com ajuste Dixon-Coles (ρ = −0,10) para placares baixos
           - pontos esperados por placar usando a regra REAL (pontos_palpite + app_config)
        4. 3 opções: (1) maior pontuação esperada, (2) placar exato mais provável,
           (3) melhor placar do 2º resultado mais provável (V/E/D)
        5. reserva a linha em `sugestoes_placar` → envia Telegram → se falhar, apaga a reserva
```

- Custo de API: 1 chamada/jogo. 429 aborta a run (mesma política do sync).
- Secrets novos: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (reusa `CRON_SECRET`, `RAPIDAPI_KEY`).
- Tabela `sugestoes_placar` (RLS sem policies → só service role).

## Tarefas

1. `_shared/palpite-modelo.ts` + testes (Vitest): poisson, pontosPalpite, lambdasDasOdds,
   lambdasDaForma, sugerirPlacares.
2. `_shared/telegram.ts` + testes: formatarMensagem (HTML escapado, horário BRT).
3. Migration `0028_sugestoes_placar.sql` (tabela) e `0029_cron_sugerir_placares.sql` (cron).
4. Edge Function `sugerir-placares/index.ts` + `deno.json`.
5. Deploy + secrets (manual do usuário: criar bot no @BotFather) + teste com `?forcar=<api_fixture_id>`.
