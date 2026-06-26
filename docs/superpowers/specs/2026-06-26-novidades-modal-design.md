# Spec: Modal de Novidades do Perfil

**Data:** 2026-06-26

---

## Objetivo

Exibir uma vez — na primeira visita à página `/jogos` após o deploy — um modal informando que o usuário agora pode alterar avatar, apelido e senha pelo perfil.

---

## Comportamento

- Ao montar, o componente lê `localStorage.getItem("cravou:novidades-perfil-v1")`
- Se valor for `"visto"` → não renderiza nada
- Se não existir → exibe o modal com animação de entrada
- **"Ir para o Perfil"** → salva flag + navega para `/perfil`
- **"Entendi"** → salva flag + fecha o modal
- Clicar fora do card (overlay) → fecha sem salvar a flag (reaparece na próxima visita)
- A key `v1` permite criar avisos futuros com chave diferente

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/novidades-modal.tsx` | Criar — client component completo |
| `src/app/jogos/page.tsx` | Modificar — adicionar `<NovidadesModal />` dentro do `<main>` |

---

## Componente `NovidadesModal`

**Diretiva:** `"use client"`

**Estado:** `visivel: boolean` (inicia `false`, setado para `true` em `useEffect` se flag ausente)

**Lógica de persistência:**
```ts
const STORAGE_KEY = "cravou:novidades-perfil-v1";

function marcarVisto() {
  localStorage.setItem(STORAGE_KEY, "visto");
}
```

**Dois handlers:**
- `handleIrPerfil` → `marcarVisto()` + `router.push("/perfil")`
- `handleFechar` → `marcarVisto()` + `setVisivel(false)`
- `handleOverlay` → `setVisivel(false)` (sem marcar visto)

**Texto exibido:**
> "Agora você pode alterar seu avatar, apelido e senha acessando o seu perfil de usuário."

**UI:**
- Overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm`
- Card: `w-full max-w-sm rounded-2xl border border-border bg-card p-6`
- Ícone `Sparkles` (lucide-react) acima do título
- Título: `"Novidade no Cravou!"` — `font-display`, uppercase
- Botão primário `variant="cta"`: "Ir para o Perfil"
- Botão ghost `variant="ghost"`: "Entendi"
- Animação: `AnimatePresence` + `motion.div` com `opacity 0→1` e `scale 0.95→1`, `duration 200ms`
- `useReducedMotion()` respeitado

---

## Sem testes

Lógica trivial (leitura/escrita de localStorage + estado booleano). Sem props externas, sem Server Actions, sem banco.
