# Palpites dos Amigos — Design Spec

**Data:** 2026-06-27
**Escopo:** Fix de RLS para predictions, página `/feed/palpites` mostrando palpites de quem você segue, e tabs de navegação no feed.

---

## Fix de RLS

A política atual `predictions_select_own` bloqueia ver palpites de outros usuários. Adicionar:

```sql
create policy "predictions_select_all" on predictions
  for select using (auth.uid() is not null);
```

Isso desbloqueia o `PalpitesGrid` no `/perfil/[id]` sem nenhuma mudança de código.

---

## Nova query — `listarPalpitesAmigos`

Em `src/lib/feed.ts`:

```typescript
export type PalpiteAmigo = PalpiteResumido & {
  autor: { id: string; apelido: string; avatar_url: string | null };
  feito_em: string;
};
```

`listarPalpitesAmigos(sessaoId: string, offset?: number): Promise<PalpiteAmigo[]>`

- Busca os `following_id` da tabela `follows` onde `follower_id = sessaoId`
- Busca predictions desses usuários, join com `matches` e `profiles`
- Ordena por `created_at desc`, limite 20, paginado por `offset`
- Retorna `[]` se não segue ninguém

---

## Página `/feed/palpites`

**Server Component** `src/app/feed/palpites/page.tsx`:
- Redireciona para `/entrar` se não logado
- Busca `listarPalpitesAmigos(sessao.userId)`
- Renderiza `<FeedTabs abaAtiva="palpites" />` + `<PalpitesAmigosList postsIniciais={...} userId={...} />`

**Client Component** `src/components/feed/feed-tabs.tsx`:
- Props: `abaAtiva: "posts" | "palpites"`
- Duas abas: "Posts" → `/feed`, "Palpites" → `/feed/palpites`
- Aba ativa com estilo destacado (`bg-primary text-primary-foreground`), inativa com hover

**Client Component** `src/components/feed/palpite-amigo-card.tsx`:
- Props: `palpite: PalpiteAmigo`
- Exibe: avatar + apelido (link `/perfil/[id]`), times do jogo, placar do palpite, badge (Exato/Resultado/Erro/Aguardando), placar real se finalizado, tempo relativo
- Reutiliza lógica de `calcBadge` de `palpite-card-compacto.tsx` (extraída para `lib/feed.ts` ou duplicada)

**Client Component** `src/components/feed/palpites-amigos-list.tsx`:
- Props: `postsIniciais: PalpiteAmigo[]`, `userId: string`
- Paginação via botão "Carregar mais", chama Server Action `carregarMaisPalpites(offset, userId)`
- Estado vazio: "Siga pessoas para ver os palpites delas aqui."

**Server Action** `src/app/feed/actions.ts`:
- Adicionar `carregarMaisPalpites(offset: number, userId: string): Promise<PalpiteAmigo[]>`

---

## Atualização de `/feed`

Adicionar `<FeedTabs abaAtiva="posts" />` no topo da página `/feed/page.tsx`, acima do `PostComposer`.

---

## File Map

| Arquivo | Ação |
|---|---|
| *(migration Supabase)* | Adicionar `predictions_select_all` |
| `src/lib/feed.ts` | Adicionar `PalpiteAmigo` e `listarPalpitesAmigos()` |
| `src/app/feed/actions.ts` | Adicionar `carregarMaisPalpites()` |
| `src/components/feed/feed-tabs.tsx` | Criar — tabs Posts/Palpites |
| `src/components/feed/palpite-amigo-card.tsx` | Criar — card do palpite com autor |
| `src/components/feed/__tests__/palpite-amigo-card.test.tsx` | Criar — testes do card |
| `src/components/feed/palpites-amigos-list.tsx` | Criar — lista paginada |
| `src/app/feed/palpites/page.tsx` | Criar — Server Component |
| `src/app/feed/page.tsx` | Modificar — adicionar FeedTabs |
