# Forma recente (últimos 5 jogos por equipe) — Design

**Data:** 2026-07-17
**Contexto:** feature futura listada em "Fora de escopo" da spec `2026-07-16-multi-competicao.md`
(seção "Últimos 5 jogos por equipe (V-E-D)").

## Objetivo

Exibir, no card de cada jogo **não finalizado**, a **forma recente** dos dois times —
os últimos 5 resultados de cada um **na competição atual** — como informação de apoio ao
palpite. Cada time mostra 5 badges V/E/D (Vitória/Empate/Derrota) sempre visíveis, com um
detalhe recolhível (adversário + placar de cada jogo).

## Decisões de design

- **Escopo:** apenas jogos **desta competição** (ex.: só Brasileirão), não todas as
  competições do time.
- **Fonte:** calculada **do nosso próprio banco** (`matches` já sincronizados). Zero chamadas
  à FlashScore, sem tabela nova, sem alteração no `sync-matches`. Sempre fresca.
- **Resultado (V/E/D):** derivado do placar relativo ao time. Usa o placar dos 90 minutos já
  armazenado (`placar_casa`/`placar_fora`), coerente com a regra dos 90 min (mata-mata ignora
  prorrogação) — não há tratamento especial adicional aqui, pois o placar gravado já é o de
  tempo normal.
- **Menos de 5 jogos:** no início da competição um time pode ter 0–4 jogos finalizados; mostra
  os que houver.
- **Exibição:** badges sempre visíveis + detalhe recolhível ("ver forma"), só para jogos com
  `status !== 'finalizado'` e desde que haja ao menos 1 jogo de forma para algum dos dois times.

## Cálculo da forma

Para um time `T` numa competição `C`: os **5 jogos `finalizado` mais recentes** (por
`inicio_em desc`) de `C` em que `time_casa = T` ou `time_fora = T`.

Para cada jogo, o resultado sob a ótica de `T`:

- `T` é mandante: `V` se `placar_casa > placar_fora`, `E` se igual, `D` se menor.
- `T` é visitante: espelhado (`placar_fora` vs `placar_casa`).

Ordem de exibição: **mais antigo → mais recente** (mais recente à direita), convenção
FlashScore/Sofascore.

## Armazenamento

**Nenhuma migration.** A forma é derivada em tempo de leitura a partir de `matches`. Os dados
necessários (`time_casa`, `time_fora`, `placar_casa`, `placar_fora`, `inicio_em`, `status`,
`competicao_id`) já existem.

> Observação sobre identidade de times: a forma é casada por **nome do time** (`time_casa`/
> `time_fora`), que é como `matches` já os grava e exibe. Não é necessário persistir o
> `team_id` da FlashScore para esta feature.

## Componentes

### `src/lib/matches.ts` (modificar)

Tipos e funções novas:

```ts
export type ResultadoForma = "V" | "E" | "D";

export type FormaJogo = {
  resultado: ResultadoForma;
  golsPro: number;
  golsContra: number;
  adversario: string;   // nome do adversário
  mando: "casa" | "fora";
  inicioEm: string;     // ISO, para ordenação/exibição
};

// pura, testável sem banco: recebe todos os jogos finalizados da competição
export function calcularForma(
  jogosFinalizados: Pick<Match, "time_casa" | "time_fora" | "placar_casa" | "placar_fora" | "inicio_em">[],
  time: string,
): FormaJogo[];   // no máx. 5, ordenada mais antigo → mais recente
```

- `listarFormaCompeticao(competicaoId): Promise<Map<string, FormaJogo[]>>` — uma **única
  query** que busca os jogos `finalizado` da competição (colunas mínimas) e monta o mapa
  `nomeTime → FormaJogo[]` em memória via `calcularForma`. Volume pequeno (uma temporada de
  pontos-corridos), um round-trip.

### `src/components/jogos/forma-times.tsx` (novo — client)

- `"use client"`. Props: `formaCasa: FormaJogo[]`, `formaFora: FormaJogo[]`, nomes dos times.
- **Badges sempre visíveis**: uma linha por time — nome + até 5 bolinhas. Cada bolinha traz a
  **letra V/E/D dentro** (Verde/Amarelo/Vermelho) — não depende só de cor (acessibilidade).
  Contraste ≥ 4.5:1, dark + light, `title`/`aria-label` por badge com adversário e placar.
- **Toggle "▾ ver forma"** (`ChevronDown` lucide, rotaciona ao abrir; recolhido por padrão,
  `cursor-pointer`, foco visível). Expandido: por time, lista os 5 jogos com adversário e
  placar (ex.: "2×1 Santos (V)").
- Time sem nenhum jogo finalizado → sua linha de badges é omitida (ou "—").

### `src/components/jogos/match-card.tsx` (modificar)

- Recebe `formaCasa`/`formaFora` (via a página, opcional).
- Renderiza `<FormaTimes ... />` **só quando** `match.status !== 'finalizado'` **e** houver ao
  menos 1 `FormaJogo` para algum dos times. Posição: após o `PalpiteForm`, junto do bloco de
  odds.

### `src/app/jogos/page.tsx` (modificar)

- Após obter a competição ativa e a lista de jogos, chamar `listarFormaCompeticao(competicaoId)`
  uma vez e passar `formaCasa = mapa.get(match.time_casa) ?? []` e `formaFora` a cada card.

## Fluxo de dados

```
matches (já sincronizados)
  → listarFormaCompeticao(competicaoId)  [1 query]
  → calcularForma (TS puro)  → Map<time, FormaJogo[]>
página jogos → MatchCard(formaCasa, formaFora)
  → FormaTimes (client, badges + recolhível)
```

## Tratamento de erros / casos extremos

- Time sem jogos finalizados: badges omitidos para aquele time; se ambos vazios, o bloco de
  forma não aparece.
- Jogo `finalizado`: sem bloco de forma (consistente com odds).
- Placar nulo em jogo marcado `finalizado` (não deveria ocorrer): jogo ignorado no cálculo.
- Empate no placar: `E`.

## Testes

- `calcularForma`: time com >5 jogos (pega só os 5 mais recentes, ordem correta); time com <5
  jogos; V/E/D correto como mandante e como visitante; empate → `E`; ignora jogos com placar
  nulo; adversário/mando corretos.
- `FormaTimes`: renderiza badges recolhido (detalhe oculto); expande ao clicar; omite time sem
  jogos; letra V/E/D presente (não depende só de cor).
- `MatchCard`: mostra forma só em não-finalizado; oculta quando ambos os times sem forma.
- `npm test` e `npm run build` passam.

## Fora de escopo

- Forma considerando **todas** as competições do time.
- Forma de jogos anteriores ao início do nosso sync (só contamos o que está em `matches`).
- Persistir `team_id` da FlashScore (casamento por nome basta aqui).
- Peso/pontuação de forma, sequência (streak) destacada, confronto direto (H2H).
- Forma no card de jogos já finalizados.

## Checklist de entrega

- [ ] `calcularForma` (TS puro) + testes
- [ ] `listarFormaCompeticao` (1 query) em `src/lib/matches.ts`
- [ ] `FormaTimes` (client, badges V/E/D com letra + recolhível) + testes
- [ ] `MatchCard` renderiza forma só em não-finalizado e com dados
- [ ] `src/app/jogos/page.tsx` passa a forma aos cards
- [ ] `npm test` passa
- [ ] `npm run build` passa
