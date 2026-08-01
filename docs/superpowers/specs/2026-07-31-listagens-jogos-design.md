# Spec — Listagens de jogos: filtro de data, ordenação e paginação

**Data:** 2026-07-31
**Status:** aprovada, aguardando plano de implementação
**Posição na fila:** 2ª de 4 (1ª: [jogos adiados](2026-07-31-jogos-adiados-design.md) ✅ entregue)

## Problema

Três queixas com a mesma raiz — as listagens de jogos fazem no JavaScript o que deveria ser
query.

1. **A landing mostra jogos antigos.** A seção "Próximos jogos" chama
   `listarJogos({ soAbertos: true, minutosCorte, limite: 6 })`
   ([`page.tsx:18`](../../../src/app/page.tsx)). Dois defeitos numa linha:
   - `listarJogos` ordena por `inicio_em` **crescente** e o `limite: 6` corta os 6
     **primeiros**. Como `soAbertos` inclui jogos cuja data já passou, os mais **velhos**
     entram na frente. Com 6 ou mais jogos atrasados, a seção não mostra nenhum jogo futuro.
   - Não passa `competicaoId` nem checa opt-in, então mistura competições. Hoje não aparece
     porque a Copa está toda finalizada, mas é a mesma família do bug que fez palpites do
     Brasileirão serem feitos antes do opt-in.

2. **Sem paginação.** `/jogos` e `/historico` carregam todos os jogos da competição (261 no
   Brasileirão) numa tacada. `/historico` ainda carrega todos os palpites do usuário e cruza
   as duas listas em memória.

3. **Sem filtro de data nem controle de ordenação** em nenhuma das duas telas.

## Decisões de produto

- **Filtro de data por intervalo** de/até, com as duas pontas opcionais, usando
  `<input type="date">` nativo (dá o picker do sistema no celular) e uma ação de limpar.
- **Paginação por botão "Carregar mais"**, seguindo o padrão que o projeto já usa no feed e
  em `/feed/palpites`. Sem scroll infinito — decisão anterior do projeto, mantida.
- **Ordenação só por data**, com um controle que inverte o sentido. Padrão: `/jogos`
  crescente (próximo jogo primeiro), `/historico` decrescente (mais recente primeiro).
- **Paginação, ordenação e filtro de data valem para as duas telas** — `/jogos` e
  `/historico`.
- **A aba "Abertos" passa a significar "não encerrados"** (ver abaixo).
- **A landing mostra só jogos futuros**, da competição atual, e apenas para quem participa
  dela.

### Por que "Abertos" vira "não encerrados"

A condição atual de `soAbertos`
([`matches.ts:90-99`](../../../src/lib/matches.ts)) é: *não finalizado **e** (ao vivo **ou**
falta mais que o corte para começar **ou** já começou)*. Isso deixa um **buraco**: um jogo que
começa nos próximos 10 minutos não satisfaz nenhuma das três alternativas e **desaparece** da
aba. Não parece intencional.

O rótulo também já é impreciso: "Abertos" inclui jogo cujo prazo de palpite fechou e que só
aguarda resultado.

A definição nova é `status in ('agendado', 'ao_vivo')` — o jogo aparece enquanto não terminou:
palpitável, começando agora, ao vivo ou aguardando resultado. Query simples, indexável, sem
buraco. O próprio card já mostra se o palpite está aberto ou fechado, então a lista não precisa
codificar isso. O chip pode ser renomeado para **"A fazer"**, mais honesto que "Abertos".

## Arquitetura

### O ganho real da paginação

Buscar 261 linhas do Postgres nunca foi o gargalo. O custo é **renderizar 261 cards** e
trafegar linhas largas (incluindo `odds` jsonb). A paginação ataca isso, e escala quando o
campeonato dobrar de tamanho. Vale registrar para não se atribuir à mudança um ganho que ela
não tem.

### A nova API de `listarJogos`

```ts
listarJogos({
  competicaoId,
  situacao?: "a_fazer" | "encerrados" | "todos",  // substitui soAbertos/soEncerrados
  de?: string,          // "AAAA-MM-DD" em BRT, inclusivo
  ate?: string,         // "AAAA-MM-DD" em BRT, inclusivo
  ordem?: "asc" | "desc",
  offset?: number,
  limite?: number,
  apenasFuturos?: boolean,      // inicio_em > agora — usado pela landing
  incluirNaoJogaveis?: boolean, // opt-in do admin, herdado da spec 1
})
```

Cada opção vira query, nenhuma fica em memória:

| Opção | Tradução PostgREST |
|---|---|
| `situacao: "a_fazer"` | `.in("status", ["agendado", "ao_vivo"])` |
| `situacao: "encerrados"` | `.eq("status", "finalizado")` |
| `situacao: "todos"` | `.in("status", ["agendado", "ao_vivo", "finalizado"])` |
| `incluirNaoJogaveis: true` | sem restrição de status (admin vê `adiado`/`cancelado`) |
| `de` / `ate` | `.gte` / `.lt` com fronteira timestamptz (ver fuso) |
| `apenasFuturos` | `.gt("inicio_em", <agora ISO>)` |
| `ordem` | `.order("inicio_em", { ascending: ordem !== "desc" })` |
| `offset` + `limite` | `.range(offset, offset + limite - 1)` |

Note que `situacao: "todos"` **exclui** `adiado` e `cancelado` — a regra da spec 1 sai da
memória e passa a viver na query, onde deveria estar.

**Retorno:** `{ jogos, total }`. O `total` vem de `{ count: "exact" }` na mesma ida ao banco e
serve ao badge do chip e à decisão de exibir "Carregar mais".

**Defaults explícitos** (para não sobrar interpretação):

| Opção | Default | Por quê |
|---|---|---|
| `situacao` | `"a_fazer"` | preserva o comportamento atual do `/jogos`, que já mostra abertos a menos que você peça outra coisa |
| `ordem` | `"asc"` | próximo jogo primeiro; `/historico` passa `"desc"` explicitamente |
| `offset` | `0` | primeira página |
| `limite` | `JOGOS_POR_PAGINA` | constante única, num módulo client-safe (o mesmo arranjo de `src/lib/feed-constants.ts`), porque a lista client precisa dela para decidir se ainda há mais |
| `apenasFuturos` | `false` | só a landing quer isso |
| `incluirNaoJogaveis` | `false` | só o `/admin` quer isso |

`JOGOS_POR_PAGINA` = **20**. Cabe várias telas de rolagem no celular sem deixar a primeira
renderização pesada, e dá 14 páginas no Brasileirão atual.

**Simplificação de brinde:** `minutosCorte` **sai** de `listarJogos` — ele só existia para o
`palpiteAberto` do filtro em memória. As páginas continuam precisando dele para o formulário de
palpite, mas param de passá-lo para a listagem.

### Fuso horário — onde isso erra em silêncio

O usuário escolhe **dias do calendário de Brasília**; `inicio_em` é UTC. Comparar a data crua
com a string ISO faz um jogo das 21h de 31/07 BRT cair em 01/08 UTC e vazar do filtro.

A fronteira vai explícita, deixando o Postgres resolver a conversão:

```
.gte("inicio_em", `${de}T00:00:00-03:00`)
.lt("inicio_em",  `${diaSeguinte(ate)}T00:00:00-03:00`)
```

`ate` é **inclusivo**, por isso o limite superior é o dia seguinte, exclusivo.

**Premissa assumida:** o offset `-03:00` é fixo. Correto para o Brasil desde a extinção do
horário de verão em 2019. Não é uma solução geral de fuso — é uma decisão consciente,
coerente com a regra do projeto de tratar tudo em `America/Sao_Paulo`.

### `/historico` — o resumo tem que sair da lista

A tela mais delicada. Hoje ela carrega todos os jogos e todos os palpites, cruza em
JavaScript (`status === 'finalizado' && palpites[j.id]`), ordena e passa **todos** os itens
para `resumoHistorico`, que calcula pontos, cravadas e aproveitamento.

Paginar quebra o resumo: ele não pode ser derivado de uma página. E o resumo **deve refletir o
filtro** — se o usuário filtra julho, o resumo mostra julho, senão engana.

A separação:

- **O resumo** roda sobre todas as linhas que casam com o filtro, numa projeção estreita
  (`pontos`, `pontos_max`, palpite e placar — o suficiente para contar cravadas). Centenas de
  linhas magras: barato.
- **A lista** é paginada, porque é ela que custa renderizar.

O cruzamento sai do JavaScript para o banco: a consulta parte de `predictions` com
`matches!inner`, filtrando competição e status no servidor, ordenando pela coluna da tabela
embutida. Isso inverte a direção da query — e é a direção certa para uma tela que é sobre *os
meus palpites*.

### A landing

```ts
listarJogos({ competicaoId: atual.id, situacao: "a_fazer",
              apenasFuturos: true, ordem: "asc", limite: 6 })
```

Mais a checagem de opt-in, que hoje não existe ali: quem não participa da competição não vê a
seção. `apenasFuturos` mata os jogos antigos; `competicaoId` + opt-in matam a mistura de
competições.

### Estado na URL, e uma armadilha já conhecida

Os filtros vivem em `searchParams` (`?situacao=&de=&ate=&ordem=`), como `/jogos` já faz hoje
com `soAbertos`. URL compartilhável, funciona sem JavaScript, e o server component renderiza a
primeira página.

O "Carregar mais" acumula no cliente sobre essa primeira página, no padrão de
[`palpites-amigos-list.tsx`](../../../src/components/feed/palpites-amigos-list.tsx).

**A armadilha:** um componente client com `useState(itensIniciais)` **ignora** o novo valor
inicial quando o servidor re-renderiza com outro filtro. É exatamente o bug do `/ranking` que
exigia F5 ao trocar de competição, corrigido em `59c2f38` com `key`. A lista precisa de `key`
na assinatura do filtro, para remontar quando o filtro muda.

## Componentes

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `src/lib/jogos/filtros.ts` | funções puras: `diaSeguinte`, `limitesDeData`, `statusPorSituacao` | nada |
| `src/lib/matches.ts` — `listarJogos` | monta a query a partir das opções; devolve `{ jogos, total }` | `filtros.ts` |
| `src/lib/historico.ts` | lista paginada de palpites + resumo sobre o conjunto filtrado | `filtros.ts` |
| `src/components/jogos/jogos-filtro.tsx` | chips de situação + intervalo de data + inverter ordem | — |
| lista client com "Carregar mais" | acumula páginas; remonta via `key` ao trocar filtro | server action |

A lógica difícil fica nas funções puras, e a camada de dados só monta a query — o padrão que o
projeto já usa em `calcularForma`, `extrairOdds` e `estadoDePendencia`.

## Testes

- **Unitários nas funções puras**, com destaque para o caso que erra em silêncio: um jogo às
  21h BRT deve ser encontrado pelo filtro do seu próprio dia, não do dia seguinte.
  `diaSeguinte` precisa virar mês e ano corretamente.
- **`listarJogos`**: os filtros chegam à query (não sobra filtragem em memória); a paginação
  corta no servidor; `situacao: "todos"` não devolve `adiado`/`cancelado`;
  `incluirNaoJogaveis` devolve.
- **`/historico`**: o resumo reflete o conjunto filtrado, não a página exibida.
- **Regressão do `key`**: trocar o filtro remonta a lista em vez de manter os itens antigos.

## Consumidores a atualizar

A troca de `soAbertos`/`soEncerrados` por `situacao` atinge cinco chamadas, mais o componente
de filtro e seus testes. O type-check do build encontra todas:

- [`src/app/jogos/page.tsx`](../../../src/app/jogos/page.tsx) (searchParams + chamada + estados vazios)
- [`src/app/page.tsx`](../../../src/app/page.tsx) (landing)
- [`src/app/historico/page.tsx`](../../../src/app/historico/page.tsx)
- [`src/app/admin/page.tsx`](../../../src/app/admin/page.tsx) (`incluirNaoJogaveis`)
- [`src/app/admin/auditoria/page.tsx`](../../../src/app/admin/auditoria/page.tsx) (`soEncerrados: true` → `situacao: "encerrados"`)
- [`src/components/jogos/jogos-filtro.tsx`](../../../src/components/jogos/jogos-filtro.tsx) e `__tests__/jogos-filtro.test.tsx`

## Fora de escopo

- Filtro por time ou por rodada — exigiria popular `matches.rodada`, hoje vazio no
  Brasileirão. A API expõe o número no `tournament.name` (`"Serie A Betano - Round 21"`);
  fica anotado para uma spec futura.
- Ranking mensal (spec 3) · alertas de jogo sem palpite (spec 4) · animações (fora da fila).
