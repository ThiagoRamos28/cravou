# Visual & UX Adjustments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 6 ajustes visuais e de UX no Cravou! na branch `feat/visual-ux-adjustments`.

**Architecture:** 6 tarefas independentes, em ordem de dependência (Task 1 é base para Tasks 2 e 6). Sem novas libs, sem alterações de banco. Todos os componentes seguem os padrões já existentes no projeto.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase SSR, Framer Motion, Vitest + RTL.

## Global Constraints

- Next.js 16 App Router — consultar `node_modules/next/dist/docs/` antes de usar APIs novas.
- Tailwind CSS v4 com `@theme inline` em `src/app/globals.css` — sem `tailwind.config`.
- Componentes com hooks/Framer Motion precisam de `"use client"`.
- Ícones: `lucide-react`. Nunca emojis como ícones.
- Dark mode e light mode: testar os dois visuais.
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- TDD: escrever o teste primeiro, ver falhar, implementar, ver passar, commitar.
- Branch: `feat/visual-ux-adjustments` (já criada).

---

## Mapa de arquivos

| Arquivo | Operação | Tarefa |
|---------|----------|--------|
| `src/lib/i18n/paises.ts` | Criar | 1 |
| `src/lib/i18n/__tests__/paises.test.ts` | Criar | 1 |
| `src/components/jogos/match-card.tsx` | Modificar | 2 |
| `src/components/jogos/__tests__/match-card.test.tsx` | Modificar | 2 |
| `src/components/jogos/palpite-form.tsx` | Modificar | 3 |
| `src/lib/matches.ts` | Modificar | 4 |
| `src/components/jogos/jogos-filtro.tsx` | Modificar | 4 |
| `src/app/jogos/page.tsx` | Modificar | 4 |
| `src/components/auth/auth-form.tsx` | Modificar | 5 |
| `src/app/entrar/actions.ts` | Modificar | 5 |
| `src/app/redefinir-senha/page.tsx` | Criar | 5 |
| `src/app/redefinir-senha/form.tsx` | Criar | 5 |
| `src/app/redefinir-senha/actions.ts` | Criar | 5 |
| `src/components/landing/hero.tsx` | Modificar | 6 |
| `src/components/landing/proximos-jogos.tsx` | Criar | 6 |
| `src/app/page.tsx` | Modificar | 6 |

---

## Task 1: Mapeamento de países EN → PT

**Files:**
- Create: `src/lib/i18n/paises.ts`
- Create: `src/lib/i18n/__tests__/paises.test.ts`

**Interfaces:**
- Produces: `traduzirPais(nome: string): string` — retorna tradução PT ou o original se não encontrado. Usada em Tasks 2 e 6.

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// src/lib/i18n/__tests__/paises.test.ts
import { describe, it, expect } from "vitest";
import { traduzirPais } from "@/lib/i18n/paises";

describe("traduzirPais", () => {
  it("traduz Brazil para Brasil", () => {
    expect(traduzirPais("Brazil")).toBe("Brasil");
  });
  it("traduz France para França", () => {
    expect(traduzirPais("France")).toBe("França");
  });
  it("traduz Germany para Alemanha", () => {
    expect(traduzirPais("Germany")).toBe("Alemanha");
  });
  it("retorna o nome original quando não há tradução", () => {
    expect(traduzirPais("UnknownCountry")).toBe("UnknownCountry");
  });
  it("é case-sensitive", () => {
    expect(traduzirPais("brazil")).toBe("brazil");
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm test -- --reporter=verbose src/lib/i18n/__tests__/paises.test.ts
```
Esperado: FAIL com "Cannot find module '@/lib/i18n/paises'"

- [ ] **Step 3: Implementar `paises.ts`**

```ts
// src/lib/i18n/paises.ts
const PAISES_PT: Record<string, string> = {
  // Americas
  "United States": "Estados Unidos",
  "Mexico": "México",
  "Canada": "Canadá",
  "Brazil": "Brasil",
  "Argentina": "Argentina",
  "Colombia": "Colômbia",
  "Uruguay": "Uruguai",
  "Ecuador": "Equador",
  "Chile": "Chile",
  "Peru": "Peru",
  "Paraguay": "Paraguai",
  "Bolivia": "Bolívia",
  "Venezuela": "Venezuela",
  "Costa Rica": "Costa Rica",
  "Panama": "Panamá",
  "Honduras": "Honduras",
  "Jamaica": "Jamaica",
  "Trinidad and Tobago": "Trinidad e Tobago",
  "Haiti": "Haiti",
  "El Salvador": "El Salvador",
  // Europe
  "France": "França",
  "Germany": "Alemanha",
  "Spain": "Espanha",
  "England": "Inglaterra",
  "Portugal": "Portugal",
  "Netherlands": "Holanda",
  "Belgium": "Bélgica",
  "Italy": "Itália",
  "Croatia": "Croácia",
  "Switzerland": "Suíça",
  "Poland": "Polônia",
  "Denmark": "Dinamarca",
  "Sweden": "Suécia",
  "Norway": "Noruega",
  "Austria": "Áustria",
  "Turkey": "Turquia",
  "Hungary": "Hungria",
  "Czech Republic": "República Tcheca",
  "Czechia": "República Tcheca",
  "Slovakia": "Eslováquia",
  "Ukraine": "Ucrânia",
  "Romania": "Romênia",
  "Greece": "Grécia",
  "Serbia": "Sérvia",
  "Scotland": "Escócia",
  "Wales": "País de Gales",
  "Ireland": "Irlanda",
  "Northern Ireland": "Irlanda do Norte",
  "Albania": "Albânia",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina",
  "Georgia": "Geórgia",
  "Slovenia": "Eslovênia",
  "Iceland": "Islândia",
  "Finland": "Finlândia",
  "Russia": "Rússia",
  // Africa
  "Morocco": "Marrocos",
  "Senegal": "Senegal",
  "Nigeria": "Nigéria",
  "Egypt": "Egito",
  "Cameroon": "Camarões",
  "Ghana": "Gana",
  "Ivory Coast": "Costa do Marfim",
  "Côte d'Ivoire": "Costa do Marfim",
  "Algeria": "Argélia",
  "Tunisia": "Tunísia",
  "South Africa": "África do Sul",
  "Mali": "Mali",
  "Burkina Faso": "Burkina Faso",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "Rep. Dem. do Congo",
  "Tanzania": "Tanzânia",
  "Angola": "Angola",
  "Zimbabwe": "Zimbábue",
  // Asia
  "Japan": "Japão",
  "South Korea": "Coreia do Sul",
  "Korea Republic": "Coreia do Sul",
  "Saudi Arabia": "Arábia Saudita",
  "Iran": "Irã",
  "Australia": "Austrália",
  "Qatar": "Catar",
  "Iraq": "Iraque",
  "Jordan": "Jordânia",
  "China": "China",
  "Indonesia": "Indonésia",
  "Uzbekistan": "Uzbequistão",
  "India": "Índia",
  "Thailand": "Tailândia",
  "Kuwait": "Kuwait",
  "Bahrain": "Barein",
  "Oman": "Omã",
  "United Arab Emirates": "Emirados Árabes Unidos",
  "New Zealand": "Nova Zelândia",
  "Fiji": "Fiji",
};

export function traduzirPais(nome: string): string {
  return PAISES_PT[nome] ?? nome;
}
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npm test -- --reporter=verbose src/lib/i18n/__tests__/paises.test.ts
```
Esperado: 5 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/paises.ts src/lib/i18n/__tests__/paises.test.ts
git commit -m "feat: mapeamento EN→PT de nomes de países (traduzirPais)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Layout simétrico + nomes PT + fuso Brasília no MatchCard

**Files:**
- Modify: `src/components/jogos/match-card.tsx`
- Modify: `src/components/jogos/__tests__/match-card.test.tsx`

**Interfaces:**
- Consumes: `traduzirPais(nome: string): string` de `@/lib/i18n/paises` (Task 1)
- Consumes: `palpite?: Prediction` prop já existente — quando presente, adiciona `border-primary/40` ao article
- Produces: card com layout `[nome 🏳] × [🏳 nome]` e horário em Brasília

**Contexto do arquivo atual:**
- `match-card.tsx` tem componente interno `Time({ nome, bandeira })` com `flex min-w-0 flex-1 items-center gap-2` — igual para os dois lados, causando assimetria
- `hora` usa `toLocaleString("pt-BR")` sem `timeZone` — usa fuso do servidor
- A prop `palpite` já existe no `MatchCard` mas não é usada no `article` container

- [ ] **Step 1: Adicionar testes de layout simétrico e tradução**

Adicionar ao final de `src/components/jogos/__tests__/match-card.test.tsx` (dentro do `describe("MatchCard")`):

```tsx
  it("time da casa tem container com justify-end (flag à direita)", () => {
    render(<MatchCard match={base} minutosCorte={999} />);
    // "Brasil" é o time_casa do fixture `base`
    const nomeCasa = screen.getByText("Brasil");
    expect(nomeCasa.parentElement).toHaveClass("justify-end");
  });

  it("time visitante NÃO tem justify-end (flag à esquerda)", () => {
    render(<MatchCard match={base} minutosCorte={999} />);
    const nomeFora = screen.getByText("Sérvia");
    expect(nomeFora.parentElement).not.toHaveClass("justify-end");
  });

  it("traduz nomes em inglês para português", () => {
    render(
      <MatchCard
        match={{ ...base, time_casa: "France", time_fora: "Germany" }}
        minutosCorte={999}
      />
    );
    expect(screen.getByText("França")).toBeInTheDocument();
    expect(screen.getByText("Alemanha")).toBeInTheDocument();
    expect(screen.queryByText("France")).not.toBeInTheDocument();
    expect(screen.queryByText("Germany")).not.toBeInTheDocument();
  });

  it("card com palpite recebe borda primária", () => {
    const palpiteFixture = {
      id: "p1",
      user_id: "u1",
      match_id: "1",
      palpite_casa: 1,
      palpite_fora: 0,
      pontos: null,
      created_at: "",
      updated_at: "",
    };
    const { container } = render(
      <MatchCard match={base} palpite={palpiteFixture} minutosCorte={999} />
    );
    const article = container.querySelector("article");
    expect(article?.className).toContain("border-primary");
  });
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm test -- --reporter=verbose src/components/jogos/__tests__/match-card.test.tsx
```
Esperado: 4 novos testes FAIL.

- [ ] **Step 3: Atualizar `match-card.tsx`**

Substituir o conteúdo completo do arquivo:

```tsx
// src/components/jogos/match-card.tsx
import { traduzirPais } from "@/lib/i18n/paises";
import type { Match } from "@/lib/matches";
import type { Prediction } from "@/lib/predictions";
import { PalpiteForm } from "@/components/jogos/palpite-form";

function Time({
  nome,
  bandeira,
  lado,
}: {
  nome: string;
  bandeira: string | null;
  lado: "casa" | "fora";
}) {
  const flag = bandeira ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bandeira}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover"
    />
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full bg-muted" aria-hidden="true" />
  );

  if (lado === "casa") {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-right font-medium">{nome}</span>
        {flag}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {flag}
      <span className="truncate font-medium">{nome}</span>
    </div>
  );
}

const STATUS_LABEL: Record<Match["status"], string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  finalizado: "Encerrado",
};

export function MatchCard({
  match,
  palpite,
  minutosCorte = 10,
}: {
  match: Match;
  palpite?: Prediction;
  minutosCorte?: number;
}) {
  const finalizado = match.status === "finalizado";
  const hora = new Date(match.inicio_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <article
      className={`rounded-2xl border bg-card p-4 ${
        palpite ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hora}</span>
        <span className={match.status === "ao_vivo" ? "font-semibold text-accent" : ""}>
          {STATUS_LABEL[match.status]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 overflow-hidden">
        <Time
          nome={traduzirPais(match.time_casa)}
          bandeira={match.bandeira_casa}
          lado="casa"
        />
        <div className="shrink-0 font-display text-xl font-bold tabular-nums">
          {finalizado ? (
            <span>
              <span>{match.placar_casa}</span>
              <span className="mx-1 text-muted-foreground">×</span>
              <span>{match.placar_fora}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">×</span>
          )}
        </div>
        <Time
          nome={traduzirPais(match.time_fora)}
          bandeira={match.bandeira_fora}
          lado="fora"
        />
      </div>
      <PalpiteForm match={match} palpite={palpite} minutosCorte={minutosCorte} />
    </article>
  );
}
```

- [ ] **Step 4: Rodar todos os testes do match-card**

```bash
npm test -- --reporter=verbose src/components/jogos/__tests__/match-card.test.tsx
```
Esperado: todos PASS (incluindo os 3 originais + 4 novos = 7 total).

- [ ] **Step 5: Commit**

```bash
git add src/components/jogos/match-card.tsx src/components/jogos/__tests__/match-card.test.tsx
git commit -m "feat: layout simétrico, nomes em PT e fuso Brasília no MatchCard

- Time casa: nome à direita, flag à esquerda do ×
- Time fora: flag à direita do ×, nome à direita
- traduzirPais() aplicado em ambos os times
- timeZone: America/Sao_Paulo no toLocaleString
- Borda border-primary/40 quando usuário tem palpite

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Destaque de palpite no dark mode (palpite-form)

**Files:**
- Modify: `src/components/jogos/palpite-form.tsx`

**Contexto:** linha 57 do arquivo atual tem `className="flex items-center gap-2 text-xs text-muted-foreground"` para o texto "Palpites encerrados: X × Y". Quando o usuário tem um palpite (`palpite` prop existe), o texto fica invisível no dark mode.

**Sem novos testes** — a mudança é visual (classe CSS condicional). Os testes existentes continuam passando.

- [ ] **Step 1: Editar `palpite-form.tsx`**

Localizar (linha ~57):
```tsx
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
```

Substituir por:
```tsx
        <div className={`flex items-center gap-2 text-xs ${palpite ? "text-foreground" : "text-muted-foreground"}`}>
```

- [ ] **Step 2: Rodar os testes existentes para confirmar sem regressão**

```bash
npm test -- --reporter=verbose src/components/jogos/
```
Esperado: todos PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/jogos/palpite-form.tsx
git commit -m "fix: texto de palpite encerrado visível no dark mode

Usa text-foreground quando o usuário tem palpite registrado,
mantém text-muted-foreground quando não há palpite.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Filtro "Palpitar agora"

**Files:**
- Modify: `src/lib/matches.ts`
- Modify: `src/components/jogos/jogos-filtro.tsx`
- Modify: `src/app/jogos/page.tsx`

**Interfaces:**
- Consumes: `palpiteAberto(inicioEm, minutosCorte)` de `@/lib/palpites/corte` — já existe
- Produces: `listarJogos` aceita `{ soAbertos?, minutosCorte?, limite? }` adicionais

- [ ] **Step 1: Atualizar `src/lib/matches.ts`**

```ts
// src/lib/matches.ts
import { createClient } from "@/lib/supabase/server";
import { palpiteAberto } from "@/lib/palpites/corte";

export type Match = {
  id: string;
  fase: string;
  rodada: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  inicio_em: string;
  status: "agendado" | "ao_vivo" | "finalizado";
  placar_casa: number | null;
  placar_fora: number | null;
};

const COLS =
  "id, fase, rodada, time_casa, time_fora, bandeira_casa, bandeira_fora, inicio_em, status, placar_casa, placar_fora";

export async function listarJogos(filtro?: {
  fase?: string;
  rodada?: string;
  soAbertos?: boolean;
  minutosCorte?: number;
  limite?: number;
}): Promise<Match[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("matches").select(COLS).order("inicio_em", { ascending: true });
    if (filtro?.fase) q = q.eq("fase", filtro.fase);
    if (filtro?.rodada) q = q.eq("rodada", filtro.rodada);
    const { data } = await q;
    let resultado = (data as Match[]) ?? [];
    if (filtro?.soAbertos) {
      const corte = filtro.minutosCorte ?? 10;
      resultado = resultado.filter((m) => palpiteAberto(m.inicio_em, corte));
    }
    if (filtro?.limite) resultado = resultado.slice(0, filtro.limite);
    return resultado;
  } catch {
    return [];
  }
}

// Fases existentes (ordenadas pela 1ª data) com suas rodadas distintas.
export async function listarFasesERodadas(): Promise<
  { fase: string; rodadas: string[] }[]
> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("matches")
      .select("fase, rodada, inicio_em")
      .order("inicio_em", { ascending: true });
    const rows = (data as { fase: string; rodada: string }[]) ?? [];
    const ordem: string[] = [];
    const mapa = new Map<string, string[]>();
    for (const r of rows) {
      if (!mapa.has(r.fase)) {
        mapa.set(r.fase, []);
        ordem.push(r.fase);
      }
      const rodadas = mapa.get(r.fase)!;
      if (r.rodada && !rodadas.includes(r.rodada)) rodadas.push(r.rodada);
    }
    return ordem.map((fase) => ({
      fase,
      rodadas: [...mapa.get(fase)!].sort(),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Atualizar `src/components/jogos/jogos-filtro.tsx`**

```tsx
// src/components/jogos/jogos-filtro.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";

const FASE_LABEL: Record<string, string> = {
  grupos: "Grupos",
  oitavas: "Oitavas",
  quartas: "Quartas",
  semi: "Semi",
  final: "Final",
};

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

export function JogosFiltro({
  fases,
  faseAtiva,
  rodadaAtiva,
  soAbertos,
}: {
  fases: { fase: string; rodadas: string[] }[];
  faseAtiva: string;
  rodadaAtiva: string;
  soAbertos: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function ir(fase: string, rodada: string) {
    const params = new URLSearchParams();
    if (fase) params.set("fase", fase);
    if (rodada) params.set("rodada", rodada);
    if (soAbertos) params.set("soAbertos", "1");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleAbertos() {
    const params = new URLSearchParams();
    if (faseAtiva) params.set("fase", faseAtiva);
    if (rodadaAtiva) params.set("rodada", rodadaAtiva);
    if (!soAbertos) params.set("soAbertos", "1");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const rodadas = fases.find((f) => f.fase === faseAtiva)?.rodadas ?? [];

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro rápido">
        <button
          type="button"
          onClick={toggleAbertos}
          aria-current={soAbertos ? "true" : undefined}
          className={chip(soAbertos)}
        >
          Palpitar agora
        </button>
      </div>
      {fases.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fase">
          {fases.map((f) => (
            <button
              key={f.fase}
              type="button"
              onClick={() => ir(f.fase, "")}
              aria-current={f.fase === faseAtiva ? "true" : undefined}
              className={chip(f.fase === faseAtiva)}
            >
              {FASE_LABEL[f.fase] ?? f.fase}
            </button>
          ))}
        </div>
      )}
      {rodadas.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rodada">
          {rodadas.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => ir(faseAtiva, r)}
              aria-current={r === rodadaAtiva ? "true" : undefined}
              className={chip(r === rodadaAtiva)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Atualizar `src/app/jogos/page.tsx`**

`getMinutosCorte` precisa ser buscado antes de `listarJogos` quando `soAbertos` está ativo. Separar em dois awaits:

```tsx
// src/app/jogos/page.tsx
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MatchCard } from "@/components/jogos/match-card";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, listarFasesERodadas } from "@/lib/matches";
import { listarMeusPalpites, getMinutosCorte } from "@/lib/predictions";

export default async function JogosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; rodada?: string; soAbertos?: string }>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const { fase, rodada, soAbertos } = await searchParams;
  const soAbertosAtivo = soAbertos === "1";
  const fases = await listarFasesERodadas();

  const faseAtiva = fase ?? fases[0]?.fase ?? "";
  const rodadaAtiva = rodada ?? "";

  const minutosCorte = await getMinutosCorte();
  const [jogos, palpites] = await Promise.all([
    listarJogos({
      fase: faseAtiva || undefined,
      rodada: rodadaAtiva || undefined,
      soAbertos: soAbertosAtivo,
      minutosCorte,
    }),
    listarMeusPalpites(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Jogos da Copa
        </h1>
        {fases.length > 0 && (
          <JogosFiltro
            fases={fases}
            faseAtiva={faseAtiva}
            rodadaAtiva={rodadaAtiva}
            soAbertos={soAbertosAtivo}
          />
        )}
        {jogos.length === 0 ? (
          <p className="text-muted-foreground">
            {soAbertosAtivo
              ? "Nenhum jogo aberto para palpite no momento."
              : "Nenhum jogo neste recorte. Ajuste o filtro acima."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {jogos.map((j) => (
              <MatchCard
                key={j.id}
                match={j}
                palpite={palpites[j.id]}
                minutosCorte={minutosCorte}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes para confirmar sem regressão**

```bash
npm test
```
Esperado: todos PASS. Verificar especialmente `match-card.test.tsx` e testes existentes de jogos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches.ts src/components/jogos/jogos-filtro.tsx src/app/jogos/page.tsx
git commit -m "feat: filtro 'Palpitar agora' na página de jogos

listarJogos aceita soAbertos/minutosCorte/limite.
JogosFiltro exibe chip 'Palpitar agora' independente de fase/rodada.
Mensagem vazia diferenciada quando filtro está ativo.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Esqueci a senha

**Files:**
- Modify: `src/components/auth/auth-form.tsx`
- Modify: `src/app/entrar/actions.ts`
- Create: `src/app/redefinir-senha/page.tsx`
- Create: `src/app/redefinir-senha/form.tsx`
- Create: `src/app/redefinir-senha/actions.ts`

**Fluxo completo:**
1. Aba "Entrar" → link "Esqueci a senha" → modo recuperar (inline, mesmo card)
2. Usuário digita e-mail → action `solicitarRedefinicaoSenha` → `resetPasswordForEmail` com `redirectTo: ${origin}/auth/callback?next=/redefinir-senha`
3. `/auth/callback` já trata o `next` param (corrigido na branch de segurança) → redireciona para `/redefinir-senha`
4. `/redefinir-senha` verifica sessão → exibe form → action `redefinirSenha` → `updateUser({ password })`
5. Sucesso → redirect `/jogos`

- [ ] **Step 1: Adicionar `solicitarRedefinicaoSenha` em `src/app/entrar/actions.ts`**

Adicionar ao final do arquivo (após `enviarMagicLink`):

```ts
export async function solicitarRedefinicaoSenha(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(magicLinkSchema, { email: formData.get("email") });
  if (!v.sucesso) return { erro: v.erro };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(v.dados.email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });
  if (error) return { erro: "Não foi possível enviar o link. Tente novamente." };

  return { ok: "Enviamos um link de redefinição para o seu e-mail." };
}
```

- [ ] **Step 2: Atualizar `src/components/auth/auth-form.tsx`**

```tsx
// src/components/auth/auth-form.tsx
"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  entrarComSenha,
  cadastrar,
  enviarMagicLink,
  solicitarRedefinicaoSenha,
} from "@/app/entrar/actions";

type Aba = "entrar" | "criar" | "magico";
type Modo = "form" | "recuperar";

const abas: { id: Aba; label: string }[] = [
  { id: "entrar", label: "Entrar" },
  { id: "criar", label: "Criar conta" },
  { id: "magico", label: "Link mágico" },
];

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="cta" className="w-full" disabled={pending}>
      {pending ? "Aguarde..." : children}
    </Button>
  );
}

export function AuthForm() {
  const [aba, setAba] = useState<Aba>("entrar");
  const [modo, setModo] = useState<Modo>("form");

  const acao =
    aba === "entrar" ? entrarComSenha : aba === "criar" ? cadastrar : enviarMagicLink;
  const [estado, formAction] = useActionState(acao, {} as { erro?: string; ok?: string });
  const [estadoRecup, formActionRecup] = useActionState(
    solicitarRedefinicaoSenha,
    {} as { erro?: string; ok?: string }
  );

  if (modo === "recuperar") {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-tight">
          Recuperar senha
        </h2>
        <form action={formActionRecup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-recup" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email-recup"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {estadoRecup?.erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {estadoRecup.erro}
            </p>
          )}
          {estadoRecup?.ok && (
            <p role="status" className="text-sm text-primary">
              {estadoRecup.ok}
            </p>
          )}
          <Submit>Enviar link de redefinição</Submit>
        </form>
        <button
          type="button"
          onClick={() => setModo("form")}
          className="mt-4 w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
      <div role="tablist" className="mb-6 flex gap-1 rounded-full bg-muted p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              aba === a.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {aba !== "magico" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={6}
              autoComplete={aba === "criar" ? "new-password" : "current-password"}
              className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {aba === "entrar" && (
              <button
                type="button"
                onClick={() => setModo("recuperar")}
                className="self-end cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                Esqueci a senha
              </button>
            )}
          </div>
        )}

        {estado?.erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        {estado?.ok && (
          <p role="status" className="text-sm text-primary">
            {estado.ok}
          </p>
        )}

        <Submit>
          {aba === "entrar"
            ? "Entrar"
            : aba === "criar"
              ? "Criar conta"
              : "Enviar link"}
        </Submit>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/app/redefinir-senha/actions.ts`**

```ts
// src/app/redefinir-senha/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoRedefinir = { erro?: string };

export async function redefinirSenha(
  _prev: EstadoRedefinir,
  formData: FormData
): Promise<EstadoRedefinir> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (senha.length < 6) return { erro: "A senha deve ter pelo menos 6 caracteres." };
  if (senha !== confirmar) return { erro: "As senhas não coincidem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível atualizar a senha. Solicite um novo link." };

  redirect("/jogos");
}
```

- [ ] **Step 4: Criar `src/app/redefinir-senha/form.tsx`**

```tsx
// src/app/redefinir-senha/form.tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { redefinirSenha, type EstadoRedefinir } from "./actions";

export function RedefinirSenhaForm() {
  const [estado, formAction] = useActionState(redefinirSenha, {} as EstadoRedefinir);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
      <h1 className="mb-6 font-display text-xl font-bold uppercase tracking-tight">
        Nova senha
      </h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-sm font-medium">
            Nova senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmar" className="text-sm font-medium">
            Confirmar senha
          </label>
          <input
            id="confirmar"
            name="confirmar"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {estado?.erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.erro}
          </p>
        )}
        <Button type="submit" variant="cta" className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Criar `src/app/redefinir-senha/page.tsx`**

```tsx
// src/app/redefinir-senha/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RedefinirSenhaForm } from "./form";

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-foreground">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-display text-2xl font-bold uppercase tracking-tight">
          Cravou!
        </span>
      </Link>
      <RedefinirSenhaForm />
    </main>
  );
}
```

- [ ] **Step 6: Rodar testes e build para checar tipos**

```bash
npm test && npm run build
```
Esperado: todos os testes PASS, build sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/app/entrar/actions.ts src/components/auth/auth-form.tsx \
  src/app/redefinir-senha/actions.ts src/app/redefinir-senha/form.tsx \
  src/app/redefinir-senha/page.tsx
git commit -m "feat: fluxo 'Esqueci a senha' com link inline e página /redefinir-senha

Link abaixo do campo senha na aba Entrar alterna para mini-form de recuperação.
solicitarRedefinicaoSenha envia e-mail via Supabase resetPasswordForEmail.
/redefinir-senha: verifica sessão, aceita nova senha + confirmação via server action.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Landing page dinâmica (Hero + Próximos Jogos)

**Files:**
- Modify: `src/components/landing/hero.tsx`
- Create: `src/components/landing/proximos-jogos.tsx`
- Modify: `src/app/page.tsx`

**Contexto:**
- `hero.tsx` é `"use client"` (usa Framer Motion) — pode receber props de server components
- `page.tsx` já busca sessão e passa `logado` para `CtaSection`; Hero não recebe `logado`
- `ProximosJogos` só renderiza quando `logado === true` (evita issue de RLS para anon em matches)

**Interfaces:**
- Consumes: `traduzirPais` de Task 1
- Consumes: `listarJogos({ soAbertos, minutosCorte, limite })` de Task 4

- [ ] **Step 1: Atualizar `src/components/landing/hero.tsx`**

Adicionar prop `logado?: boolean` e tornar o CTA inteligente:

```tsx
// src/components/landing/hero.tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero({ logado = false }: { logado?: boolean }) {
  const reduce = useReducedMotion();
  const variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : item;

  return (
    <section className="relative overflow-hidden">
      {/* fundo decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.15]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32"
      >
        <motion.span
          variants={variants}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          Copa do Mundo 2026 · bolão da galera
        </motion.span>

        <motion.h1
          variants={variants}
          className="max-w-4xl text-balance font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl"
        >
          Acertou o placar?{" "}
          <span className="text-primary">Você</span>{" "}
          <span className="text-accent">cravou!</span>
        </motion.h1>

        <motion.p
          variants={variants}
          className="max-w-prose text-pretty text-lg text-muted-foreground sm:text-xl"
        >
          Registre seus palpites para cada partida, acerte os placares e veja
          quem manda no ranking até a final.
        </motion.p>

        <motion.div
          variants={variants}
          className="mt-2 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href={logado ? "/jogos" : "/entrar"}
            className={buttonVariants("cta", "lg")}
          >
            {logado ? "Ver os jogos" : "Começar a palpitar"}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/ranking" className={buttonVariants("outline", "lg")}>
            <Target className="h-5 w-5" aria-hidden="true" />
            Ver o ranking
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Criar `src/components/landing/proximos-jogos.tsx`**

```tsx
// src/components/landing/proximos-jogos.tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { traduzirPais } from "@/lib/i18n/paises";
import type { Match } from "@/lib/matches";

export function ProximosJogos({
  jogos,
  logado,
}: {
  jogos: Match[];
  logado: boolean;
}) {
  if (jogos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <h2 className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-tight">
        Jogos abertos para palpite
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jogos.map((j) => {
          const hora = new Date(j.inicio_em).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
          return (
            <article
              key={j.id}
              className="rounded-xl border border-border bg-card p-4 text-center"
            >
              <p className="mb-2 text-xs text-muted-foreground">{hora}</p>
              <p className="font-medium">
                {traduzirPais(j.time_casa)}{" "}
                <span className="text-muted-foreground">×</span>{" "}
                {traduzirPais(j.time_fora)}
              </p>
            </article>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <Link
          href={logado ? "/jogos" : "/entrar"}
          className={buttonVariants("primary", "lg")}
        >
          {logado ? "Ver todos os jogos" : "Entrar para palpitar"}
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Atualizar `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { CtaSection } from "@/components/landing/cta-section";
import { ProximosJogos } from "@/components/landing/proximos-jogos";
import { getSessao } from "@/lib/auth/profile";
import { listarJogos, type Match } from "@/lib/matches";
import { getMinutosCorte } from "@/lib/predictions";

export default async function Home() {
  const sessao = await getSessao();
  const logado = sessao !== null;

  let proximosJogos: Match[] = [];
  if (logado) {
    const mc = await getMinutosCorte();
    proximosJogos = await listarJogos({ soAbertos: true, minutosCorte: mc, limite: 6 });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero logado={logado} />
        <ProximosJogos jogos={proximosJogos} logado={logado} />
        <Features />
        <CtaSection logado={logado} />
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 4: Rodar testes e build final**

```bash
npm test && npm run build
```
Esperado: todos PASS, build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/hero.tsx src/components/landing/proximos-jogos.tsx src/app/page.tsx
git commit -m "feat: landing page dinâmica com próximos jogos e Hero consciente de sessão

Hero recebe logado prop: CTA aponta para /jogos quando autenticado,
evitando o loop entrar → onboarding → index.
ProximosJogos exibe até 6 jogos abertos para palpite (visível só quando logado).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review do plano

**Cobertura do spec:**
- ✅ Item 1 (nomes PT + fuso): Tasks 1 + 2
- ✅ Item 2 (layout simétrico): Task 2
- ✅ Item 3 (dark mode highlight): Tasks 2 + 3
- ✅ Item 4 (filtro Palpitar agora): Task 4
- ✅ Item 5 (Esqueci a senha): Task 5
- ✅ Item 6 (landing dinâmica): Task 6

**Consistência de tipos:**
- `traduzirPais(nome: string): string` — definida Task 1, usada Tasks 2 e 6 ✅
- `listarJogos({ soAbertos?, minutosCorte?, limite? })` — definida Task 4, usada Tasks 4 e 6 ✅
- `JogosFiltro` recebe `soAbertos: boolean` — definido e wired Task 4 ✅
- `Hero({ logado?: boolean })` — definido Task 6, wired em `page.tsx` Task 6 ✅

**Placeholders:** nenhum encontrado. ✅
