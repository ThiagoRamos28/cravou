# Spec: Camada Social — Feed, Follows e Perfil Expandido

**Data:** 2026-06-27
**Fase:** Pós-Fase 1 (Auth & perfil)
**Rotas novas:** `/feed`, `/perfil/[id]`
**Rotas modificadas:** `/perfil`

---

## Objetivo

Adicionar uma camada social ao Cravou! para engajamento entre os participantes do bolão: um feed global de posts curtos (até 140 caracteres) com vínculo opcional a partidas, sistema de follows como métrica social, curtidas e menções com `@`.

---

## Escopo

| Funcionalidade | Incluído |
|---|---|
| Feed global `/feed` | ✅ |
| Composer com @menção e vínculo a jogo | ✅ |
| Curtidas com atualização otimista | ✅ |
| Follows/seguidores como métrica no perfil | ✅ |
| Perfil público `/perfil/[id]` | ✅ |
| 10 últimos palpites no perfil (grid 2×5) | ✅ |
| Notificações de menção (push/email) | ❌ futuro |
| Feed personalizado por follows | ❌ futuro |
| Reposts / quotes | ❌ futuro |

---

## Modelo de dados

### Tabela `posts`

```sql
create table posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  conteudo    text not null check (char_length(conteudo) between 1 and 140),
  jogo_id     uuid references jogos(id) on delete set null,
  created_at  timestamptz not null default now()
);
```

### Tabela `follows`

```sql
create table follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
```

### Tabela `post_curtidas`

```sql
create table post_curtidas (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
```

### Menções

Não há tabela de menções. O texto é armazenado como texto puro com `@apelido` literal. A resolução acontece na query de listagem (join `profiles` para mapear apelido → id) e na renderização do `PostCard` (regex → link React, sem `dangerouslySetInnerHTML`).

### RLS

Todas as três tabelas:

- `SELECT`: `auth.uid() IS NOT NULL` — somente usuários autenticados leem
- `INSERT posts`: `auth.uid() = user_id`
- `INSERT follows`: `auth.uid() = follower_id`
- `INSERT post_curtidas`: `auth.uid() = user_id`
- `DELETE posts`: `auth.uid() = user_id` (só o autor)
- `DELETE follows`: `auth.uid() = follower_id`
- `DELETE post_curtidas`: `auth.uid() = user_id`

---

## Estrutura de arquivos

### Novos

```
src/app/feed/
  page.tsx          # Server Component protegido — carrega 20 posts mais recentes
  actions.ts        # Server Actions: publicarPost, alternarCurtida, alternarFollow, deletarPost

src/app/perfil/[id]/
  page.tsx          # Perfil público read-only de outro usuário

src/components/feed/
  post-composer.tsx      # Client — textarea 140 chars, seletor de jogo, @menção popover
  post-card.tsx          # Client — avatar, conteúdo, curtida otimista, menu deletar
  post-list.tsx          # Client — lista + "Carregar mais"
  mencao-link.tsx        # Puro — renderiza @apelido como link a partir do texto

src/components/perfil/
  palpites-grid.tsx           # Últimos 10 palpites em grid 2×5
  palpite-card-compacto.tsx   # Card médio: bandeiras, nomes, placar, badge, pontos
  followers-modal.tsx         # Modal com lista de seguidores/seguindo
  follow-button.tsx           # Client — Seguir/Deixar de seguir (otimista)
  metricas-sociais.tsx        # Exibe "X seguidores · Y seguindo" clicáveis
```

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/app/perfil/page.tsx` | Adiciona `MetricasSociais` e `PalpitesGrid` |
| `src/components/site-header.tsx` | Adiciona link "Feed" no nav |
| `src/lib/auth/profile.ts` | Adiciona `getPerfilPublico(id)`, `getUltimosPalpites(id, limit)` |

---

## Página `/feed`

**Tipo:** Server Component protegido. Sem sessão → redireciona `/entrar`.

**Layout:** coluna central (max-width ~680px), centralizada, responsivo mobile-first.

**Carregamento inicial:** 20 posts mais recentes, `ORDER BY created_at DESC`. Query inclui join com `profiles` (avatar_url, apelido) e `jogos` (time_casa, time_fora) e contagem de curtidas + flag `curtido_por_mim`.

**Composer (`PostComposer`):**
- Textarea com placeholder "O que você tá achando?"
- Contador regressivo `140 / 140` — fica vermelho abaixo de 20 chars restantes
- Select opcional "Vincular a um jogo" — campo de texto que filtra jogos por time (busca client-side na lista carregada no servidor)
- Suporte a `@apelido`: ao digitar `@` abre popover com até 5 sugestões filtradas. Fetch de `profiles` uma única vez ao montar o componente, filtrado client-side
- Botão "Postar" desabilitado se vazio ou > 140 chars; mostra spinner durante submit
- Submit via Server Action `publicarPost` — valida tamanho, sanitiza (trim), insere, revalida cache da rota

**`PostCard`:**
- Linha superior: avatar (24px) + apelido (link `/perfil/[id]`) + tempo relativo em BRT (ex: "há 3 min", "há 2h", "27 jun")
- Corpo: conteúdo com `@apelido` renderizados como links pelo `MencaoLink`
- Badge de jogo (se vinculado): bandeiras + "BRA × ARG", link para `/jogos`
- Rodapé: botão coração com contagem (`♥ 4`) — ícone preenchido/accent se curtido, outline se não; atualização otimista
- Menu "···" visível só para o próprio autor → opção "Deletar post" com toast de 3s para desfazer antes de confirmar

**Paginação:** botão "Carregar mais" ao final da lista. Carrega próximos 20 via Server Action com `offset`. Sem infinite scroll.

---

## Página `/perfil` (modificada)

**Adições abaixo do avatar/apelido:**

`MetricasSociais`: linha "**12 seguidores** · **5 seguindo**" — números clicáveis abrem `FollowersModal`.

`FollowersModal`: modal com duas abas "Seguidores" / "Seguindo" — lista de avatares + apelidos, cada um linkando para `/perfil/[id]`.

**Nova seção "Últimos palpites"** abaixo dos cards de edição:

`PalpitesGrid`: grid CSS 2 colunas, 5 linhas. Cada célula é um `PalpiteCardCompacto`.

`PalpiteCardCompacto`:
- Bandeiras dos dois países (via `lib/i18n/paises.ts`)
- Nomes das seleções abreviados
- Placar apostado (ex: `2 × 1`)
- Se jogo encerrado: placar real + badge `Exato` / `Resultado` / `Erro` + pontos (ex: `+10`)
- Se jogo não encerrado: badge `Aguardando` em neutro

---

## Página `/perfil/[id]` (nova)

**Tipo:** Server Component protegido. `[id]` é o UUID do usuário.

Visualmente idêntica à `/perfil`, mas:
- Campos de edição (apelido, avatar, senha) **não aparecem**
- `FollowButton` no lugar dos cards de edição: botão "Seguir" / "Deixar de seguir" (atualização otimista via `alternarFollow`)
- Mesma `MetricasSociais` e `PalpitesGrid`
- Se `id === auth.uid()` → redireciona para `/perfil`

---

## Server Actions (`src/app/feed/actions.ts`)

| Action | Validação | Efeito |
|---|---|---|
| `publicarPost(conteudo, jogoId?)` | tamanho 1–140, `auth.uid()` presente | INSERT em `posts`, revalida `/feed` |
| `alternarCurtida(postId)` | `auth.uid()` presente | UPSERT/DELETE em `post_curtidas` |
| `alternarFollow(followingId)` | `auth.uid() ≠ followingId` | UPSERT/DELETE em `follows` |
| `deletarPost(postId)` | `auth.uid() = post.user_id` | DELETE em `posts` |
| `carregarMaisPosts(offset)` | offset ≥ 0 | SELECT com LIMIT 20 OFFSET |

---

## Interações de segurança

- Conteúdo de posts: texto puro, nunca renderizado com `dangerouslySetInnerHTML`. Links de `@menção` são construídos no componente React a partir de dados do banco, não do texto raw.
- Todas as Server Actions verificam `auth.uid()` no servidor antes de qualquer operação.
- RLS é a última linha de defesa — valida mesmo se a Action for chamada diretamente.
- `avatar_url` continua restrito ao domínio DiceBear (validação já existente em `lib/avatars.ts`).

---

## Testes

- `publicarPost`: rejeita vazio, > 140 chars, sem sessão
- `alternarCurtida`: idempotente (curtir duas vezes = 1 curtida)
- `alternarFollow`: idempotente; rejeita `follower = following`
- `deletarPost`: rejeita se `auth.uid() ≠ post.user_id`
- `PalpiteCardCompacto`: renderiza badge correto para cada estado (exato/resultado/erro/aguardando)
- `MencaoLink`: renderiza `@apelido` como link, texto sem @ permanece intacto
- `PostComposer`: desabilita botão acima de 140 chars

---

## Fuso horário

Todos os `created_at` armazenados em UTC. Exibição de tempo relativo nos posts usa `{ timeZone: "America/Sao_Paulo" }` como base para calcular "há X min/h".
