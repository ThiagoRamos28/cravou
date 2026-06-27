# Pessoas & Compartilhar Palpite — Design Spec

**Data:** 2026-06-27
**Escopo:** Duas features pequenas sobre descoberta de usuários e engajamento social no feed.

---

## Feature 1 — Página `/pessoas`

### Objetivo

Permitir que usuários encontrem e sigam outros membros do bolão mesmo sem ter visto nenhum post deles no feed.

### Arquitetura

**Nova query em `src/lib/feed.ts`:**

```typescript
export type UsuarioComFollow = PerfilBasico & { ja_sigo: boolean };

listarUsuarios(sessaoId: string): Promise<UsuarioComFollow[]>
```

Busca todos os perfis (exceto o próprio usuário), faz join com `follows` para saber quais o usuário já segue, ordena por `apelido` alfabeticamente.

**Página `src/app/pessoas/page.tsx`** (Server Component):
- Redireciona para `/entrar` se não logado
- Busca `listarUsuarios(sessao.userId)`
- Renderiza `<SiteHeader />`, `<SiteFooter />` e `<UsuariosList />`

**Componente `src/components/pessoas/usuarios-list.tsx`** (Client Component):
- Props: `usuarios: UsuarioComFollow[]`, `userId: string`
- Estado: `filtro: string` (input controlado)
- Filtra em tempo real pela substring do `apelido` (case-insensitive, sem roundtrip)
- Cada item: avatar (32×32, `avatarPadrao` como fallback), apelido como `<Link href="/perfil/[id]">`, `<FollowButton followingId={id} isSeguindoInicial={ja_sigo} />`
- Estado vazio (sem resultados no filtro): mensagem "Nenhum usuário encontrado."
- Estado vazio (sem membros): mensagem "Nenhum outro membro ainda."

**SiteHeader:** adiciona link "Pessoas" entre "Feed" e "Jogos".

### Sem testes unitários novos

`FollowButton` já está testado. A lógica de filtro é trivial; cobertura virá pelos testes de integração existentes.

---

## Feature 2 — Compartilhar palpite no feed

### Objetivo

Após salvar um palpite, oferecer ao usuário a chance de publicar um post no feed com o palpite e um texto de provocação/zuação.

### Arquitetura

**Sem migration nova.** O post usa `jogo_id` existente (tabela `posts`) + o texto do usuário. Os placares do palpite aparecem no texto pré-sugerido.

**Mudança em `EstadoPalpite` (`src/app/jogos/actions.ts`):**

```typescript
export type EstadoPalpite = {
  erro?: string;
  ok?: string;
  // Adicionado para o modal de compartilhamento:
  jogoId?: string;
  timeCasa?: string;
  timeFora?: string;
  palpiteCasa?: number;
  palpiteFora?: number;
};
```

`salvarPalpite` já recebe `match_id` e os placares via FormData — basta retorná-los no estado de sucesso.

**Componente `src/components/palpites/compartilhar-modal.tsx`** (Client Component):
- Props: `jogoId`, `timeCasa`, `timeFora`, `palpiteCasa`, `palpiteFora`, `onClose: () => void`
- Exibe um mini-card somente-leitura mostrando o palpite (ex: "Brasil 2 × 1 Argentina")
- Textarea para texto de zuação, limite 140 chars, contador visível
- Texto pré-sugerido: `"Cravo ${palpiteCasa} × ${palpiteFora}! 🔥"` (editável)
- Botão "Postar no feed" → chama `publicarPost(texto, jogoId)` → fecha modal
- Botão "Pular" → fecha modal sem postar
- Erro da action exibido inline

**Integração em `PalpiteForm`** (`src/components/jogos/palpite-form.tsx`):
- Quando `estado.ok` é verdadeiro e `estado.jogoId` está presente, renderiza `<CompartilharModal ... onClose={() => limparEstado()} />`
- "Limpar estado" = controla um `useState<boolean> modalFechado` local. Quando `true`, o modal não é renderizado mesmo com `estado.ok`. Reseta para `false` a cada novo submit (via `useEffect` monitorando `estado.ok`). O `useActionState` em si não precisa ser resetado.

### Testes

- `compartilhar-modal.test.tsx`: renderiza o mini-card com os placares; submit chama `publicarPost`; botão Pular não chama `publicarPost`

---

## File Map

| Arquivo | Ação |
|---|---|
| `src/lib/feed.ts` | Adicionar `UsuarioComFollow` e `listarUsuarios()` |
| `src/app/pessoas/page.tsx` | Criar — Server Component |
| `src/components/pessoas/usuarios-list.tsx` | Criar — Client Component com filtro |
| `src/components/site-header.tsx` | Adicionar link "Pessoas" |
| `src/app/jogos/actions.ts` | Ampliar `EstadoPalpite` com campos do palpite salvo |
| `src/components/palpites/compartilhar-modal.tsx` | Criar — Client Component |
| `src/components/palpites/__tests__/compartilhar-modal.test.tsx` | Criar — testes do modal |
| `src/components/jogos/palpite-form.tsx` | Integrar modal após `estado.ok` |
