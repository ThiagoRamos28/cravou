'# Ranking com Temporadas Separadas (Temporada 1 + Temporada 2 + Geral)

## Contexto

A partir de 2026-07-04, o modelo de pontuação mudou (Modelo A: 15/7/4/1 em vez de 10/7/5/2). Para refletir isso no app, o ranking da página `/ranking` precisa:

1. Permitir visualizar rankings **separados por temporada** (T1: grupos até 03/07, T2: mata-mata a partir de 04/07, Geral: soma de ambas)
2. Manter o design visual do pódio e tabela **exatamente como estão hoje** (zero mudança estética)
3. Adicionar controle de seleção de temporada + explicação de pontuação

---

## Design

### Estrutura visual (sem mudanças)

Página `/ranking` mantém layout atual:
- Pódio (3 blocos) — mesmo design, mesma estrutura
- Tabela de ranking — mesmas colunas, mesma lógica de destaque do usuário

### Novo: Dropdown de temporada + Tooltip

**Posição:** Acima do pódio, logo abaixo do título "Ranking"

**Elementos:**
- Dropdown/select com 3 opções:
  - "Temporada 1 (Grupos)"
  - "Temporada 2 (Mata-mata)"
  - "Ranking Geral"
- Default: "Ranking Geral"
- Ícone `ⓘ` (lucide `Info`) ao lado, clicável
  - Abre tooltip/popover com tabela de pontuação:
    ```
    Temporada 1 (até 03/07)
    ├─ Placar exato: 10 pts
    ├─ Resultado (V/E/D): 7 pts
    ├─ Saldo de gols: 5 pts
    └─ Time marca: 2 pts
    
    Temporada 2 (a partir de 04/07)
    ├─ Placar exato: 15 pts
    ├─ Resultado (V/E/D): 7 pts
    ├─ Saldo de gols: 4 pts
    └─ Time marca: 1 pt
    ```
  - Tooltip sempre mostra **ambas** as temporadas (não muda com dropdown)
  - Valores lidos de `app_config` em runtime

**Comportamento:**
- Ao mudar dropdown, pódio e tabela recarregam com dados da temporada selecionada
- Skeleton/loading state durante recarga
- Seleção é local (não persiste em URL — pode persistir em localStorage se desejar UX melhor, mas não obrigatório para MVP)

---

## Lógica de dados

### Definição de temporadas

- **Temporada 1:** Jogos com `matches.inicio_em < '2026-07-04'` (pontuação 10/7/5/2)
- **Temporada 2:** Jogos com `matches.inicio_em >= '2026-07-04'` (pontuação 15/7/4/1)
- **Geral:** Todos os jogos (soma T1 + T2)

### Função SQL (`supabase/migrations/...`)

Estender `public.ranking()` com parâmetro de período:

```sql
create or replace function public.ranking(p_periodo text default 'geral')
returns table (
  user_id uuid,
  apelido text,
  avatar_url text,
  pontos bigint,
  cravadas bigint,
  palpites_pontuados bigint
) language sql stable security definer set search_path = '' as $$
  select
    pr.id, pr.apelido, pr.avatar_url,
    coalesce(sum(p.pontos), 0)::bigint as pontos,
    count(*) filter (
      where p.pontos is not null
        and p.palpite_casa = m.placar_casa
        and p.palpite_fora = m.placar_fora
    )::bigint as cravadas,
    count(p.id) filter (where p.pontos is not null)::bigint as palpites_pontuados
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m on m.id = p.match_id
  where case p_periodo
    when 'temporada_1' then m.inicio_em < '2026-07-04'
    when 'temporada_2' then m.inicio_em >= '2026-07-04'
    when 'geral' then true
    else true
  end
  group by pr.id, pr.apelido, pr.avatar_url
  order by pontos desc, cravadas desc;
$$;
```

**Chamadas na UI:**
- `ranking('temporada_1')` para T1
- `ranking('temporada_2')` para T2
- `ranking('geral')` para ranking geral (ou `ranking()` sem parâmetro, default)

---

## Componentes afetados

### Novos

- `src/components/ranking/season-selector.tsx`
  - Dropdown + tooltip de pontuação
  - Emite evento/callback ao mudar período

### Modificados

- `src/app/ranking/page.tsx`
  - State para `selectedPeriod` (default: 'geral')
  - Passa período para chamadas de `ranking()`
  - Controla skeleton loading ao mudar período
  - Integra `<SeasonSelector />` acima do pódio

- `src/lib/ranking.ts` (se houver função helper)
  - Aceitar parâmetro `period` nas funções que chamam `ranking()`

---

## Comportamento de casos extremos

- **Nenhum jogo finalizado em T2 (muito cedo):** Ranking T2 vazio ou mostra "Sem resultados ainda"
- **Usuário sem palpites em T1:** Não aparece no ranking T1
- **Usuário logado não está em top do período:** Destaque normal (conforme lógica atual)
- **Empate em pontos:** Ordem por cravadas DESC (já está em `ranking()`)

---

## Testes

- Chamar `ranking('temporada_1')` manualmente e validar que filtra `inicio_em < '2026-07-04'`
- Chamar `ranking('temporada_2')` manualmente e validar que filtra `inicio_em >= '2026-07-04'`
- Chamar `ranking('geral')` e validar que soma ambas
- UI: mudar dropdown, confirmar que pódio e tabela recarregam com dados corretos
- UI: tooltip exibe pontuação de ambas temporadas (não muda ao trocar dropdown)
- Mobile: dropdown e tooltip acessíveis em < 640px

---

## Fora de escopo

- Persistência de período selecionado em URL (pode ser adicionada depois)
- Histórico de "mudanças de ranking ao longo do tempo" por temporada
- Filtro de ranking por fase/rodada (continua só por temporada)
- Alterar design visual do pódio ou tabela

---

## Checklist de entrega

- [ ] Migration criada com função `ranking(p_periodo)` parametrizada
- [ ] `SeasonSelector` implementado (dropdown + tooltip)
- [ ] `src/app/ranking/page.tsx` integra selector e recarrega dados
- [ ] Testes manuais passam (T1, T2, Geral em browser)
- [ ] Mobile responsivo (dropdown acessível em < 640px)
- [ ] Dark/light theme funcional no tooltip
- [ ] `npm test` passa
- [ ] `npm run build` passa
