# Spec: Página de Perfil do Usuário

**Data:** 2026-06-26
**Fase:** Pós-Fase 1 (Auth & perfil)
**Rota:** `/perfil`

---

## Objetivo

Permitir que o usuário autenticado gerencie seus dados de conta diretamente na aplicação: alterar apelido, trocar avatar (com múltiplos estilos) e mudar a senha — tudo acessível a partir do dropdown no header.

---

## Navegação de acesso

O `UserMenu` no header (avatar + apelido) vira um dropdown client component. Ao clicar, abre um menu com duas opções:

- **Editar perfil** → navega para `/perfil`
- **Sair** → submete o form POST `/auth/sair` (comportamento atual mantido)

O dropdown fecha ao clicar fora ou pressionar `Escape`.

---

## Rota `/perfil`

**Tipo:** Server Component protegido.

- Sem sessão ativa → redireciona para `/entrar`
- Carrega o perfil via `getPerfil()` no servidor
- Renderiza três cards independentes em coluna: **Apelido**, **Avatar**, **Senha**

---

## Estrutura de arquivos

### Novos

```
src/app/perfil/
  page.tsx          # Server Component — carrega perfil, monta os cards
  actions.ts        # Server Actions: atualizarApelido, atualizarAvatar, atualizarSenha

src/components/perfil/
  apelido-form.tsx  # Client component — useActionState + atualizarApelido
  avatar-form.tsx   # Client component — abas de estilo + grid de avatares
  senha-form.tsx    # Client component — useActionState + atualizarSenha
```

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/components/auth/user-menu.tsx` | Vira dropdown com "Editar perfil" + "Sair" |
| `src/lib/avatars.ts` | Adiciona `ESTILOS_AVATAR` com 5 estilos DiceBear |
| `src/lib/auth/validation.ts` | Adiciona `atualizarSenhaSchema` |

---

## Card: Apelido

**Componente:** `ApelidoForm`

- Campo de texto pré-preenchido com o apelido atual
- Validação: `perfilSchema.shape.apelido` (2–20 chars, já existente)
- Server Action: `atualizarApelido(prevState, formData)`
  - Atualiza `profiles.apelido` via Supabase
  - Sucesso: `revalidatePath("/perfil")` + retorna `{ sucesso: true }`
  - Erro: retorna `{ erro: string }`
- Exibe mensagem de sucesso inline ("Apelido atualizado!") ou erro

---

## Card: Avatar

**Componente:** `AvatarForm`

### Estilos disponíveis (`avatars.ts`)

```ts
export const ESTILOS_AVATAR: Record<string, string[]> = {
  "fun-emoji":  ["gol", "craque", "artilheiro", "zaga", "goleiro", "torcida"],
  "adventurer": ["camisa10", "meiocampo", "lateral", "zagueiro", "atacante", "reserva"],
  "bottts":     ["robo-gol", "robo-passe", "robo-chute", "robo-falta", "robo-escanteio", "robo-impedimento"],
  "pixel-art":  ["pixel-verde", "pixel-laranja", "pixel-azul", "pixel-branco", "pixel-amarelo", "pixel-vermelho"],
  "lorelei":    ["torcedora", "tecnica", "arbitro", "mascote", "comentarista", "repórter"],
}
```

URL gerada: `https://api.dicebear.com/9.x/{estilo}/svg?seed={seed}`

`AVATAR_OPTIONS` (lista plana com seeds do `fun-emoji`) continua exportado para não quebrar o onboarding.

### UI

- Abas horizontais no topo, uma por estilo (nome capitalizado)
- A aba do estilo do avatar atual começa selecionada; se o avatar atual não for DiceBear, seleciona `fun-emoji`
- Grid de 6 avatares (56×56 px) abaixo das abas
- Avatar selecionado: borda `border-primary`; hover: `border-border`
- Botão "Salvar avatar" desabilitado se o avatar selecionado for igual ao atual

### Server Action: `atualizarAvatar`

- Valida `avatar_url` via `perfilSchema.shape.avatar_url`
- Atualiza `profiles.avatar_url` via Supabase
- Sucesso: `revalidatePath("/perfil")` + retorna `{ sucesso: true }`

---

## Card: Senha

**Componente:** `SenhaForm`

### Campos

| Campo | Nome no form | Tipo |
|---|---|---|
| Senha atual | `senha_atual` | `password` |
| Nova senha | `senha_nova` | `password` |
| Confirmar nova senha | `confirmar` | `password` |

### Validação (`atualizarSenhaSchema`)

```ts
z.object({
  senha_atual: z.string().min(1, "Informe a senha atual."),
  senha_nova: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
  confirmar: z.string().min(1, "Confirme a nova senha."),
}).refine(d => d.senha_nova === d.confirmar, {
  message: "As senhas não coincidem.",
  path: ["confirmar"],
})
```

### Server Action: `atualizarSenha`

1. Valida os campos com `atualizarSenhaSchema`
2. Busca o e-mail do usuário via `supabase.auth.getUser()`
3. Verifica senha atual: `supabase.auth.signInWithPassword({ email, password: senha_atual })`
   - Falha → retorna `{ erro: "Senha atual incorreta." }`
4. Atualiza: `supabase.auth.updateUser({ password: senha_nova })`
5. Sucesso → retorna `{ sucesso: true }`, form exibe "Senha alterada com sucesso"

**Nota:** usuários que entraram via magic link (sem senha definida) receberão "Senha atual incorreta" ao tentar — comportamento aceitável para o escopo atual.

---

## UserMenu — Dropdown

**Implementação:** `"use client"`, estado local `aberto: boolean`.

### Comportamento

- Clicar no trigger (avatar + apelido + chevron) → toggle `aberto`
- Clicar fora → fecha (`useEffect` + `mousedown` no `document`)
- Pressionar `Escape` → fecha (`keydown` listener)

### Acessibilidade

- Trigger: `aria-haspopup="menu"`, `aria-expanded={aberto}`
- Menu: `role="menu"`
- Itens: `role="menuitem"`

### Animação

Framer Motion com `AnimatePresence`:
- `opacity: 0 → 1`, `y: 4 → 0`
- Duration: 150ms, ease: `easeOut`
- Respeitando `prefers-reduced-motion` via `useReducedMotion()`

### Estrutura visual

```
[ avatar  apelido ▾ ]
         ┌─────────────────┐
         │  Editar perfil  │  → Link /perfil
         │  ─────────────  │
         │  Sair           │  → form POST /auth/sair
         └─────────────────┘
```

---

## Testes

Cada novo componente client terá testes co-localizados em `__tests__/` (Vitest + RTL):

| Componente/Action | O que testar |
|---|---|
| `ApelidoForm` | render com valor inicial, submit chama action, exibe erro/sucesso |
| `AvatarForm` | troca de aba muda grid, seleção atualiza hidden input, botão desabilitado quando igual |
| `SenhaForm` | validação client (senhas não coincidem), exibe erro, exibe sucesso |
| `UserMenu` | abre/fecha dropdown, Escape fecha, links corretos |
| `atualizarSenha` (action) | senha incorreta retorna erro, sucesso retorna `{ sucesso: true }` |

---

## Fora do escopo

- Upload de imagem personalizada como avatar
- Alterar e-mail
- Excluir conta
- Autenticação de dois fatores
