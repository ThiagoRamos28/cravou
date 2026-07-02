# Design: Melhorias de UX mobile (+ refinamentos desktop)

## Contexto

O Cravou! foi construído mobile-first no CSS, mas três pontos degradam a experiência
em celular:

1. **Navegação do header estoura** — `SiteHeader` renderiza 6 links inline
   (Pessoas, Feed, Jogos, Ranking, Histórico, Regras) sem tratamento responsivo;
   em telas pequenas ficam espremidos/quebrados.
2. **Formulário de palpite ruim no touch** — inputs de placar com 36px de altura
   (`h-9 w-14`), `type="number"` sem `inputMode`, alvos de toque abaixo do mínimo
   recomendado (44px).
3. **Ranking com 10 colunas** — posição, jogador, 6 contadores por ícone, pontos e
   aproveitamento não cabem em tela de celular.

O Histórico já é card-based e funciona bem no mobile — fora de escopo.

## Decisões (com o usuário)

- Navegação mobile: **bottom nav estilo app** (não hambúrguer, não scroll horizontal).
- Entrada de placar: **steppers +/−** em volta do número (não apenas inputs maiores).
- Ranking mobile: **colunas essenciais + linha expansível** (não scroll horizontal,
  não cards).
- Desktop: incluir **estado ativo nos links do header** e **hover nas linhas do
  ranking**; nada além disso.

## 1. Bottom nav (mobile) + header enxuto

### Novo componente `src/components/bottom-nav.tsx` (client)

- Barra fixa no rodapé: `fixed bottom-0 inset-x-0 z-30`, `border-t border-border`,
  `bg-background/95 backdrop-blur`.
- Visível apenas em mobile (`sm:hidden`) e apenas para usuários logados (renderizada
  condicionalmente pelo layout/página com base no perfil, mesmo padrão do header).
- 4 abas: **Jogos** (`/jogos`, ícone `CalendarDays`), **Ranking** (`/ranking`,
  `Trophy`), **Feed** (`/feed`, `MessageSquare`), **Pessoas** (`/pessoas`, `Users`).
- Cada aba: ícone + rótulo em texto pequeno, alvo de toque ≥ 44px de altura,
  `cursor-pointer`, foco visível.
- Aba ativa: destaque com `text-primary` (demais em `text-muted-foreground`),
  detectada via `usePathname()` — ativa quando o pathname é igual à rota ou começa
  com ela (`/feed` ativa também em `/feed/palpites`).
- Padding inferior com `env(safe-area-inset-bottom)` para iPhones com home indicator.
- Acessibilidade: `<nav aria-label="Navegação principal">`, `aria-current="page"` na
  aba ativa.

### Hook compartilhado `src/lib/nav.ts`

- `useRotaAtiva(href: string): boolean` — client hook usando `usePathname()`; regra:
  ativo se `pathname === href` ou `pathname.startsWith(href + "/")`. Usado pela
  bottom nav e pelos links do header.

### Mudanças no `SiteHeader`

- O `<nav>` de links passa a `hidden sm:flex` (some no mobile; desktop inalterado em
  estrutura).
- Os links do header ganham estado ativo (novo componente client
  `src/components/nav-link.tsx` que envolve `Link` + `useRotaAtiva`): link ativo com
  `bg-muted text-foreground font-semibold`; inativos como hoje.
- **Histórico** e **Regras** saem do header em todas as larguras? **Não** — continuam
  no header no desktop. No mobile, ficam acessíveis pelo dropdown do `UserMenu`
  (adicionar os dois itens ao dropdown, visíveis em todas as larguras — no desktop
  viram acesso redundante, sem problema).

### Espaço para a barra

- Onde a bottom nav aparece, o conteúdo precisa de respiro inferior:
  `pb-20 sm:pb-0` aplicado no wrapper de layout das páginas autenticadas (ou na
  própria página, seguindo o padrão atual de cada página compor `SiteHeader` +
  `main`). A bottom nav é renderizada junto do `SiteHeader` (mesmos pontos de uso),
  evitando um layout global novo.

## 2. Steppers no formulário de palpite

### Novo componente `src/components/ui/score-stepper.tsx` (client)

- Props: `{ id: string; name: string; label: string; defaultValue?: number }`.
- Estrutura: botão `−` | `<input>` | botão `+`.
  - Botões: 44×44px (`h-11 w-11`), `type="button"`, `rounded-lg border border-border`,
    `cursor-pointer`, `aria-label` ("Diminuir/Aumentar palpite {time}").
  - Input: `inputMode="numeric"` + `pattern="[0-9]*"` (teclado numérico no mobile),
    `type="text"` com sanitização para dígitos, largura `w-12`, altura `h-11`,
    texto centralizado. Mantém `id`/`name` recebidos (compatibilidade com o submit
    da server action e com os testes existentes).
- Comportamento: `−` decrementa até mínimo 0 (botão desabilitado em 0); `+`
  incrementa (sem teto no cliente; validação de sanidade continua no servidor).
  Campo vazio tratado como 0 ao usar os botões. Digitação direta continua possível.
- Estado controlado internamente (useState inicializado com `defaultValue`).

### Mudanças no `PalpiteForm`

- Substitui os dois `<input type="number">` do formulário aberto por dois
  `ScoreStepper` (casa e fora), mantendo os mesmos `id`s (`casa-${match.id}`,
  `fora-${match.id}`) e `name`s (`palpite_casa`, `palpite_fora`).
- O bloco de "palpites encerrados" (inputs sr-only desabilitados) permanece como está.
- Layout do form: continua centralizado; em telas muito estreitas os steppers
  empilham naturalmente com `flex-wrap` (já existente).

## 3. Ranking responsivo com linha expansível

### `RankingTable` (desktop ≥ sm) — mudanças mínimas

- Tabela completa idêntica à atual, apenas com `hover:bg-muted/50 transition-colors`
  nas linhas (`<tr>`), preservando o destaque `bg-primary/10` da linha do próprio
  usuário.
- Toda a tabela atual fica dentro de um wrapper `hidden sm:block`.

### Nova visão mobile (`< sm`)

- Novo componente client `src/components/ranking/ranking-lista-mobile.tsx`:
  - Lista de linhas: `#`, avatar + apelido (+ badge "você"), pontos em destaque, e
    chevron indicando expansão.
  - Linha inteira é um `<button>` (`aria-expanded`, `cursor-pointer`, alvo ≥ 44px)
    que alterna a expansão daquela linha (múltiplas linhas podem ficar abertas ao
    mesmo tempo — estado é um `Set` de user_ids).
  - Painel expandido: os 6 contadores (mesmos ícones/labels de `COLUNAS_ICONE`,
    com valor; ícone + número lado a lado, `title`/`aria-label` com o rótulo
    completo) + linha "Aproveitamento: X%".
  - Animação de expansão leve (altura/opacidade) via Framer Motion respeitando
    `useReducedMotion`; sem animação quando reduzido.
- `COLUNAS_ICONE` é exportado (ou movido para um módulo compartilhado
  `src/components/ranking/colunas.tsx`) para reuso entre tabela e lista mobile sem
  duplicação.
- A página `/ranking` renderiza ambos (tabela `hidden sm:block`, lista `sm:hidden`);
  o pódio existente não muda.

## Testes (Vitest + RTL)

- `bottom-nav.test.tsx`: renderiza 4 abas; aba correspondente ao pathname atual tem
  `aria-current="page"`; links apontam para as rotas certas. (`usePathname` mockado.)
- `nav-link.test.tsx` ou teste do hook: `useRotaAtiva` ativa em rota exata e em
  subrota, inativa em rota irmã.
- `score-stepper.test.tsx`: incrementa com `+`, decrementa com `−`, não desce de 0
  (botão − desabilitado em 0), aceita digitação direta apenas de dígitos, honra
  `defaultValue`, expõe `name`/`id` corretos.
- `palpite-form.test.tsx` (existente): continua passando — mesmos ids/names; ajustar
  apenas se a mudança de `type="number"` para `type="text" inputMode="numeric"`
  quebrar algum matcher (`spinbutton` → `textbox`).
- `ranking-lista-mobile.test.tsx`: linha fechada não mostra contadores; clique
  expande (`aria-expanded=true`) e mostra contadores + aproveitamento; segunda linha
  pode expandir sem fechar a primeira; badge "você" na linha do usuário.

## Checklist de design system (aplica a tudo)

- Funcionar em dark E light; tokens (`bg-muted`, `text-primary`, `border-border`).
- `cursor-pointer` em clicáveis, foco visível, contraste ≥ 4.5:1.
- Transições 150–300ms; `prefers-reduced-motion` respeitado em qualquer animação.
- Ícones lucide-react (nunca emoji).
- UI em pt-BR.

## Fora de escopo

- Histórico (já é card-based e adequado ao mobile).
- Feed, páginas de perfil, admin.
- PWA/manifest/instalável.
- Alterações de pontuação ou dados.
