# Plano: Novos Modelos de Pontuação — Cravou!

## Contexto

Usuários reclamam que acertar o placar exato ("Cravou!") não compensa o suficiente em relação
a acertar só o vencedor. Com os valores atuais (10/7/5/2), quem cravar um placar exato leva
apenas +3 pts sobre quem acertou o saldo — diferença pequena para o risco de tentar o exato.
A proposta é apresentar 3 modelos alternativos a serem votados/decididos antes da próxima fase
do torneio (mata-mata).

### Sistema atual

| Nível           | Condição                              | Pontos |
|-----------------|---------------------------------------|--------|
| Cravou!         | Placar exato                          | 10     |
| Saldo certo     | Vencedor + diferença de gols igual    | 7      |
| Vencedor        | Resultado V/E/D certo                 | 5      |
| Gols parciais   | Acertou gols de um dos times          | 2      |
| Erro            | Nada                                  | 0      |

**Infra relevante:**
- `supabase/migrations/0006_pontuacao_ranking.sql` — funções SQL `pontos_palpite()` e `recalcular_pontos()`
- `src/lib/palpites/pontuacao.ts` — espelho TypeScript da lógica SQL
- `app_config` — tabela de configuração; admin altera via `/admin/config`
- `public.recalcular_todos()` — recalcula todos os palpites finalizados ao mudar config
- `matches.fase` — campo existente (`'grupos'`, futuramente `'oitavas'`, `'quartas'`, etc.)

---

## Os Três Modelos Propostos

---

### Modelo A — "Cravou Manda"
> **Filosofia:** mesma estrutura, mas abre um abismo entre o exato e os demais níveis.

| Nível         | Atual | Novo |
|---------------|-------|------|
| Cravou!       | 10    | **15** |
| Saldo certo   | 7     | **7**  |
| Vencedor      | 5     | **4**  |
| Gols parciais | 2     | **1**  |
| Erro          | 0     | 0      |

**Gap exato → saldo:** sobe de 3 para **8 pontos**.

**Prós:**
- Implementação trivial — apenas atualizar 4 valores em `app_config` via admin (sem migration)
- Recalcula tudo automaticamente via `recalcular_todos()`
- Não quebra nenhuma estrutura existente

**Contras:**
- Histórico dos grupos muda de valor (quem cravou nos grupos ganha retroativamente +5 pts)
- Pode concentrar muito o ranking em torno de quem teve sorte de acertar exatos

---

### Modelo B — "Fase Decisiva"
> **Filosofia:** pontuação sobe progressivamente com a importância da fase. Grupos valem
> o atual; mata-mata dobra os prêmios.

| Nível         | Grupos (atual) | Oitavas/Quartas | Semi/Final |
|---------------|----------------|-----------------|------------|
| Cravou!       | 10             | **15**          | **20**     |
| Saldo certo   | 7              | **9**           | **12**     |
| Vencedor      | 5              | **6**           | **7**      |
| Gols parciais | 2              | **3**           | **4**      |

**Prós:**
- Mantém os grupos intactos — nada muda retroativamente
- Cria emoção crescente conforme o torneio avança
- O Cravou! na final vale o dobro — premia quem "se arriscou" no jogo mais importante

**Contras:**
- Requer trabalho técnico: novas chaves em `app_config`, `pontos_palpite()` deve receber `p_fase`,
  `recalcular_pontos()` deve passar `matches.fase` à função
- UI do admin precisa de novos campos de configuração
- Mais complexo de explicar na página de regras

**Arquivos a modificar:**
- `supabase/migrations/` — nova migration adicionando chaves `pts_exato_oitavas`, `pts_exato_semi_final`, etc. e reescrevendo `pontos_palpite()` com `CASE fase`
- `src/lib/palpites/pontuacao.ts` — `ConfigPontos` ganha mapa por fase
- `src/app/admin/config/` — novos campos no formulário
- `src/app/regras/page.tsx` — tabela de pontos por fase

---

### Modelo C — "Tudo ou Quase Nada"
> **Filosofia:** simplifica radicalmente para 3 níveis. Ou você cravou, ou acertou o
> vencedor, ou errou. Sem meios-termos.

| Nível       | Condição             | Pontos |
|-------------|----------------------|--------|
| Cravou!     | Placar exato         | **15** |
| Vencedor    | Resultado V/E/D certo| **5**  |
| Erro        | Nada                 | 0      |

*Remove completamente os níveis "Saldo certo" e "Gols parciais".*

**Prós:**
- Regra ultra-simples — qualquer pessoa entende em 10 segundos
- Diferença de 10 pts entre o Cravou! e o simples acerto de resultado é enorme
- Ranking vira um mapa de quem realmente conhece futebol (sabe o placar, não só quem ganha)

**Contras:**
- Quebra o modelo "pega a maior" atual — precisa reescrever `pontos_palpite()` em SQL e TypeScript
- Retira pontuação de quem acertou o saldo (pode frustrar quem joga com essa estratégia)
- Retroativamente recalcula tudo — histórico de grupos muda

**Arquivos a modificar:**
- `supabase/migrations/` — reescrever `pontos_palpite()` removendo casos 2 e 4
- `src/lib/palpites/pontuacao.ts` — simplificar `pontuar()`
- `src/lib/palpites/__tests__/pontuacao.test.ts` — remover/adaptar testes dos níveis extintos
- `src/components/ranking/ranking-table.tsx` — remover colunas saldo/gols
- `src/app/regras/page.tsx` — atualizar explicação

---

## Comparativo de Complexidade

| Critério                    | Modelo A | Modelo B | Modelo C |
|-----------------------------|----------|----------|----------|
| Linhas de código             | ~0       | ~150     | ~80      |
| Novas migrations             | 0        | 1        | 1        |
| Muda retroativamente grupos  | Sim      | Não      | Sim      |
| Dificuldade de explicar      | Fácil    | Médio    | Fácil    |
| Risco de bugs                | Mínimo   | Médio    | Baixo    |

---

## Recomendação

Para a próxima fase (mata-mata), o **Modelo B** é o mais elegante: mantém os grupos com os
valores que os jogadores já conhecem e aumenta a emoção progressivamente. É também o que cria
mais motivo para acompanhar os jogos até a final.

Se a prioridade for velocidade de entrega, o **Modelo A** é implementado em minutos sem risco.

---

## Próximos Passos (pós-decisão)

1. Escolher o modelo
2. Se Modelo A: admin entra em `/admin/config` e altera os 4 valores → `recalcular_todos()` automático
3. Se Modelo B ou C: criar migration + atualizar TypeScript + testes + admin UI + página de regras
4. Registrar decisão no vault (nota de retrospectiva)
5. Comunicar mudança aos participantes (pode ser via modal de novidades, padrão já existe)

---

## Verificação

- `npm test` — todos os testes de `pontuacao.test.ts` devem passar após mudança
- Admin: alterar config → verificar se `recalcular_todos()` recalcula corretamente
- Página `/ranking` — verificar se as colunas por nível refletem os novos valores
- Página `/regras` — atualizar tabela de pontuação para o modelo escolhido
