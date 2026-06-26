# Auditoria Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a rota `/admin/auditoria` com tabela de palpites por jogo (pontuação + motivo) e log de ações admin/sync, além de enriquecer o `audit_log` com registros automáticos de mudanças de placar na Edge Function.

**Architecture:** Server Component puro com `searchParams` para seleção de jogo; dados em `lib/auditoria/palpites.ts` e `lib/auditoria/log.ts`; componentes de exibição em `components/admin/`; a Edge Function registra mudanças de placar no `audit_log` via `service_role`. O acesso às `predictions` requer `service_role` para contornar o RLS que restringe leitura ao próprio usuário.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript, Supabase JS v2, Tailwind CSS v4, lucide-react, Vitest + React Testing Library.

## Global Constraints

- Nome do app: `Cravou!` (com ponto de exclamação)
- Idioma UI: Português do Brasil
- Tailwind v4: utilitários via `@theme inline` em `globals.css`, sem `tailwind.config`
- Ícones: somente `lucide-react` — nunca emojis como ícone
- `"use client"` apenas quando indispensável (page é Server Component puro)
- Segredos: `SUPABASE_SERVICE_ROLE_KEY` somente server-side (nunca `NEXT_PUBLIC_`)
- Commits terminam com `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- TDD: escrever teste primeiro, ver falhar, implementar, ver passar, commitar
- `searchParams` no App Router do Next.js 16 é uma `Promise` — sempre `await searchParams`

---

## File Map

**Criar:**
- `src/lib/supabase/admin.ts` — `createAdminClient()` com service_role (contorna RLS)
- `src/lib/auditoria/palpites.ts` — tipos, `motivoPalpite()`, `listarPalpitesJogo()`
- `src/lib/auditoria/__tests__/palpites.test.ts` — testes unitários de `motivoPalpite()`
- `src/lib/auditoria/log.ts` — tipos, `formatarDescricaoLog()`, `listarLog()`
- `src/lib/auditoria/__tests__/log.test.ts` — testes unitários de `formatarDescricaoLog()`
- `src/components/admin/auditoria-palpites.tsx` — tabela de palpites (Server Component)
- `src/components/admin/__tests__/auditoria-palpites.test.tsx` — testes do componente
- `src/components/admin/auditoria-log.tsx` — lista do log (Server Component)
- `src/app/admin/auditoria/page.tsx` — página de auditoria

**Modificar:**
- `src/app/admin/page.tsx` — adicionar link "Auditoria" no header
- `src/app/admin/actions.ts` — enriquecer `dados_novos` de `salvar_placar` com `time_casa`/`time_fora`
- `supabase/functions/sync-matches/index.ts` — registrar mudanças de placar no `audit_log`

---

## Task 1: `motivoPalpite()` + `listarPalpitesJogo()`

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/auditoria/palpites.ts`
- Create: `src/lib/auditoria/__tests__/palpites.test.ts`

**Interfaces:**
- Produces:
  - `MotivoNivel` — `"exato" | "saldo" | "resultado" | "gols" | "erro"`
  - `PalpiteAuditado` — `{ id, apelido, palpite_casa, palpite_fora, pontos, motivo, detalhe }`
  - `motivoPalpite(pc, pf, rc, rf): { motivo: MotivoNivel; detalhe: string }`
  - `listarPalpitesJogo(matchId: string): Promise<PalpiteAuditado[]>`

- [ ] **Step 1: Criar o helper `createAdminClient`**

Criar `src/lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 2: Escrever os testes de `motivoPalpite()` (devem falhar)**

Criar `src/lib/auditoria/__tests__/palpites.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { motivoPalpite } from "@/lib/auditoria/palpites";

describe("motivoPalpite", () => {
  it("placar exato → motivo exato", () => {
    const r = motivoPalpite(3, 2, 3, 2);
    expect(r.motivo).toBe("exato");
    expect(r.detalhe).toBe("Placar exato");
  });

  it("vencedor certo + diferença exata → saldo", () => {
    const r = motivoPalpite(2, 0, 3, 1); // casa vence por 2
    expect(r.motivo).toBe("saldo");
    expect(r.detalhe).toMatch(/diferença/i);
  });

  it("vencedor certo mas diferença errada → resultado", () => {
    const r = motivoPalpite(1, 0, 3, 1);
    expect(r.motivo).toBe("resultado");
  });

  it("empate não-exato → resultado", () => {
    const r = motivoPalpite(1, 1, 2, 2);
    expect(r.motivo).toBe("resultado");
  });

  it("errou resultado, acertou gols da casa → gols (detalhe menciona casa)", () => {
    const r = motivoPalpite(3, 1, 3, 2); // casa acertou (3), fora errou
    expect(r.motivo).toBe("gols");
    expect(r.detalhe).toMatch(/casa/i);
    expect(r.detalhe).toContain("3");
  });

  it("errou resultado, acertou gols do fora → gols (detalhe menciona fora)", () => {
    const r = motivoPalpite(0, 3, 3, 3); // errou resultado (empate≠vitória), acertou gols do fora
    // sign(0-3)=-1, sign(3-3)=0 → mesmoResultado=false; placarFora(3)=palpiteFora(3) → gols
    expect(r.motivo).toBe("gols");
    expect(r.detalhe).toMatch(/fora/i);
    expect(r.detalhe).toContain("3");
  });

  it("errou tudo → erro", () => {
    const r = motivoPalpite(0, 3, 3, 2);
    expect(r.motivo).toBe("erro");
  });
});
```

- [ ] **Step 3: Rodar os testes para confirmar que falham**

```
npm test -- src/lib/auditoria/__tests__/palpites.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/auditoria/palpites'`

- [ ] **Step 4: Implementar `palpites.ts` com `motivoPalpite()` e `listarPalpitesJogo()`**

Criar `src/lib/auditoria/palpites.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";

export type MotivoNivel = "exato" | "saldo" | "resultado" | "gols" | "erro";

export type PalpiteAuditado = {
  id: string;
  apelido: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  motivo: MotivoNivel;
  detalhe: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function motivoPalpite(
  palpiteCasa: number,
  palpiteFora: number,
  placarCasa: number,
  placarFora: number
): { motivo: MotivoNivel; detalhe: string } {
  const mesmoResultado =
    Math.sign(palpiteCasa - palpiteFora) === Math.sign(placarCasa - placarFora);

  if (palpiteCasa === placarCasa && palpiteFora === placarFora)
    return { motivo: "exato", detalhe: "Placar exato" };

  if (
    placarCasa !== placarFora &&
    mesmoResultado &&
    palpiteCasa - palpiteFora === placarCasa - placarFora
  )
    return { motivo: "saldo", detalhe: "Vencedor certo e diferença de gols exata" };

  if (mesmoResultado)
    return { motivo: "resultado", detalhe: "Resultado (V/E/D) correto" };

  if (palpiteCasa === placarCasa)
    return {
      motivo: "gols",
      detalhe: `Acertou os gols do time da casa (${placarCasa})`,
    };

  if (palpiteFora === placarFora)
    return {
      motivo: "gols",
      detalhe: `Acertou os gols do time de fora (${placarFora})`,
    };

  return { motivo: "erro", detalhe: "Errou resultado e placares" };
}

type RawPredRow = {
  id: string;
  user_id: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  matches: { placar_casa: number | null; placar_fora: number | null } | null;
};

export async function listarPalpitesJogo(
  matchId: string
): Promise<PalpiteAuditado[]> {
  if (!UUID_RE.test(matchId)) return [];
  try {
    const supabase = createAdminClient();

    const { data: preds } = await supabase
      .from("predictions")
      .select(
        "id, user_id, palpite_casa, palpite_fora, pontos, matches(placar_casa, placar_fora)"
      )
      .eq("match_id", matchId)
      .limit(200);

    if (!preds || preds.length === 0) return [];
    const rows = preds as unknown as RawPredRow[];

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, apelido")
      .in("id", userIds);

    const apelidoMap = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; apelido: string | null }) => [
        p.id,
        p.apelido ?? "Sem apelido",
      ])
    );

    return rows.map((row) => {
      const m = row.matches;
      const { motivo, detalhe } =
        m?.placar_casa != null && m?.placar_fora != null
          ? motivoPalpite(
              row.palpite_casa,
              row.palpite_fora,
              m.placar_casa,
              m.placar_fora
            )
          : { motivo: "erro" as MotivoNivel, detalhe: "Jogo sem placar definido" };

      return {
        id: row.id,
        apelido: apelidoMap.get(row.user_id) ?? "Sem apelido",
        palpite_casa: row.palpite_casa,
        palpite_fora: row.palpite_fora,
        pontos: row.pontos,
        motivo,
        detalhe,
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Rodar os testes para confirmar que passam**

```
npm test -- src/lib/auditoria/__tests__/palpites.test.ts
```

Esperado: PASS (7 testes)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/auditoria/palpites.ts src/lib/auditoria/__tests__/palpites.test.ts
git commit -m "feat: motivoPalpite() e listarPalpitesJogo() com testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: `formatarDescricaoLog()` + `listarLog()`

**Files:**
- Create: `src/lib/auditoria/log.ts`
- Create: `src/lib/auditoria/__tests__/log.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` de `@/lib/supabase/admin`
- Produces:
  - `EntradaLog` — `{ id, criado_em, acao, apelido_admin, descricao, dados_anteriores, dados_novos }`
  - `formatarDescricaoLog(acao, apelido_admin, dados_anteriores, dados_novos): string`
  - `listarLog(): Promise<EntradaLog[]>`

- [ ] **Step 1: Escrever os testes de `formatarDescricaoLog()` (devem falhar)**

Criar `src/lib/auditoria/__tests__/log.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatarDescricaoLog } from "@/lib/auditoria/log";

describe("formatarDescricaoLog", () => {
  it("salvar_placar com nomes de time inclui jogo e placar", () => {
    const r = formatarDescricaoLog(
      "salvar_placar",
      "AdminJoão",
      { placar_casa: 2, placar_fora: 1 },
      { placar_casa: 3, placar_fora: 2, time_casa: "Turkey", time_fora: "USA" }
    );
    expect(r).toContain("Turkey");
    expect(r).toContain("USA");
    expect(r).toContain("2×1");
    expect(r).toContain("3×2");
    expect(r).toContain("AdminJoão");
  });

  it("salvar_placar sem nomes de time omite jogo", () => {
    const r = formatarDescricaoLog(
      "salvar_placar",
      null,
      { placar_casa: 0, placar_fora: 0 },
      { placar_casa: 1, placar_fora: 0 }
    );
    expect(r).toContain("0×0");
    expect(r).toContain("1×0");
  });

  it("sync_placar_auto inclui jogo e placar final", () => {
    const r = formatarDescricaoLog(
      "sync_placar_auto",
      null,
      { placar_casa: null, placar_fora: null },
      { placar_casa: 3, placar_fora: 2, time_casa: "Turkey", time_fora: "USA" }
    );
    expect(r).toMatch(/sync/i);
    expect(r).toContain("Turkey");
    expect(r).toContain("3×2");
  });

  it("disparar_sync menciona admin quando presente", () => {
    const r = formatarDescricaoLog("disparar_sync", "AdminJoão", null, null);
    expect(r).toContain("AdminJoão");
  });

  it("disparar_sync sem admin é genérico", () => {
    const r = formatarDescricaoLog("disparar_sync", null, null, null);
    expect(r).toMatch(/sync/i);
  });

  it("acao desconhecida retorna a própria acao", () => {
    const r = formatarDescricaoLog("acao_nova", null, null, null);
    expect(r).toBe("acao_nova");
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```
npm test -- src/lib/auditoria/__tests__/log.test.ts
```

Esperado: FAIL — `Cannot find module '@/lib/auditoria/log'`

- [ ] **Step 3: Implementar `log.ts`**

Criar `src/lib/auditoria/log.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type EntradaLog = {
  id: string;
  criado_em: string;
  acao: string;
  apelido_admin: string | null;
  descricao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
};

type RawLogRow = {
  id: string;
  criado_em: string;
  acao: string;
  user_id: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
};

export function formatarDescricaoLog(
  acao: string,
  apelido_admin: string | null,
  dados_anteriores: Record<string, unknown> | null,
  dados_novos: Record<string, unknown> | null
): string {
  const d = dados_novos;
  const a = dados_anteriores;

  switch (acao) {
    case "salvar_placar": {
      const jogo =
        d?.time_casa && d?.time_fora ? `${d.time_casa} × ${d.time_fora}: ` : "";
      const antes = a ? `${a.placar_casa}×${a.placar_fora}` : "—";
      const depois = d ? `${d.placar_casa}×${d.placar_fora}` : "—";
      const admin = apelido_admin ? ` (por ${apelido_admin})` : "";
      return `${jogo}${antes} → ${depois}${admin}`;
    }
    case "sync_placar_auto": {
      const jogo =
        d?.time_casa && d?.time_fora
          ? `${d.time_casa} × ${d.time_fora}`
          : "jogo";
      const placar = d ? ` ${d.placar_casa}×${d.placar_fora}` : "";
      return `Sync automática: ${jogo}${placar}`;
    }
    case "disparar_sync":
      return apelido_admin
        ? `Sync manual disparada por ${apelido_admin}`
        : "Sync manual disparada";
    case "alterar_config": {
      const chave = String(d?.chave ?? "?");
      return `Config ${chave}: ${a?.valor ?? "?"} → ${d?.valor ?? "?"}`;
    }
    default:
      return acao;
  }
}

export async function listarLog(): Promise<EntradaLog[]> {
  try {
    const supabase = await createClient();

    const { data: logData } = await supabase
      .from("audit_log")
      .select("id, criado_em, acao, user_id, dados_anteriores, dados_novos")
      .order("criado_em", { ascending: false })
      .limit(50);

    if (!logData || logData.length === 0) return [];
    const rows = logData as unknown as RawLogRow[];

    const userIds = [
      ...new Set(
        rows.map((r) => r.user_id).filter((id): id is string => id != null)
      ),
    ];

    const apelidoMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, apelido")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        apelidoMap.set(
          (p as { id: string; apelido: string | null }).id,
          (p as { id: string; apelido: string | null }).apelido ?? "Admin"
        );
      }
    }

    return rows.map((row) => {
      const apelido_admin = row.user_id
        ? (apelidoMap.get(row.user_id) ?? null)
        : null;
      return {
        id: row.id,
        criado_em: row.criado_em,
        acao: row.acao,
        apelido_admin,
        descricao: formatarDescricaoLog(
          row.acao,
          apelido_admin,
          row.dados_anteriores,
          row.dados_novos
        ),
        dados_anteriores: row.dados_anteriores,
        dados_novos: row.dados_novos,
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Rodar para confirmar que passam**

```
npm test -- src/lib/auditoria/__tests__/log.test.ts
```

Esperado: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auditoria/log.ts src/lib/auditoria/__tests__/log.test.ts
git commit -m "feat: formatarDescricaoLog() e listarLog() com testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Componentes `AuditoriaPalpites` e `AuditoriaLog`

**Files:**
- Create: `src/components/admin/auditoria-palpites.tsx`
- Create: `src/components/admin/__tests__/auditoria-palpites.test.tsx`
- Create: `src/components/admin/auditoria-log.tsx`

**Interfaces:**
- Consumes: `PalpiteAuditado`, `MotivoNivel` de `@/lib/auditoria/palpites`; `EntradaLog` de `@/lib/auditoria/log`
- Produces: `<AuditoriaPalpites palpites={PalpiteAuditado[]}>`, `<AuditoriaLog entradas={EntradaLog[]}>`

- [ ] **Step 1: Escrever testes do componente `AuditoriaPalpites` (devem falhar)**

Criar `src/components/admin/__tests__/auditoria-palpites.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditoriaPalpites } from "@/components/admin/auditoria-palpites";
import type { PalpiteAuditado } from "@/lib/auditoria/palpites";

const palpites: PalpiteAuditado[] = [
  {
    id: "p1",
    apelido: "Dannilo",
    palpite_casa: 0,
    palpite_fora: 3,
    pontos: 0,
    motivo: "erro",
    detalhe: "Errou resultado e placares",
  },
  {
    id: "p2",
    apelido: "Mandioca",
    palpite_casa: 1,
    palpite_fora: 2,
    pontos: 2,
    motivo: "gols",
    detalhe: "Acertou os gols do time de fora (2)",
  },
];

describe("AuditoriaPalpites", () => {
  it("renderiza o apelido e o palpite de cada usuário", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    expect(screen.getByText("Dannilo")).toBeInTheDocument();
    expect(screen.getByText("Mandioca")).toBeInTheDocument();
    expect(screen.getAllByText(/0 × 3/)).toHaveLength(1);
    expect(screen.getAllByText(/1 × 2/)).toHaveLength(1);
  });

  it("ícone de motivo tem o atributo title com o detalhe", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    const iconeErro = screen.getByTitle("Errou resultado e placares");
    expect(iconeErro).toBeInTheDocument();
    const iconeGols = screen.getByTitle("Acertou os gols do time de fora (2)");
    expect(iconeGols).toBeInTheDocument();
  });

  it("badge de pontos > 0 tem classe text-primary", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    // Mandioca tem 2 pontos
    const badges = screen.getAllByText(/^\d+$/);
    const badge2 = badges.find((el) => el.textContent === "2");
    expect(badge2?.className).toMatch(/text-primary/);
  });

  it("estado vazio exibe mensagem de seleção", () => {
    render(<AuditoriaPalpites palpites={[]} />);
    expect(screen.getByText(/selecione um jogo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```
npm test -- src/components/admin/__tests__/auditoria-palpites.test.tsx
```

Esperado: FAIL — `Cannot find module '@/components/admin/auditoria-palpites'`

- [ ] **Step 3: Implementar `auditoria-palpites.tsx`**

Criar `src/components/admin/auditoria-palpites.tsx`:

```tsx
import { Trophy, Target, CheckCircle, Circle, X } from "lucide-react";
import type { PalpiteAuditado, MotivoNivel } from "@/lib/auditoria/palpites";

type IconeComponent = React.ComponentType<{
  className?: string;
  title?: string;
  "aria-label"?: string;
}>;

const ICONES: Record<MotivoNivel, IconeComponent> = {
  exato: Trophy,
  saldo: Target,
  resultado: CheckCircle,
  gols: Circle,
  erro: X,
};

const LABELS: Record<MotivoNivel, string> = {
  exato: "Placar exato",
  saldo: "Saldo certo",
  resultado: "Resultado certo",
  gols: "Acertou gols",
  erro: "Errou",
};

export function AuditoriaPalpites({
  palpites,
}: {
  palpites: PalpiteAuditado[];
}) {
  if (palpites.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Selecione um jogo finalizado para ver os palpites.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3 text-left font-semibold">Apelido</th>
            <th className="px-3 py-3 text-center font-semibold">Palpite</th>
            <th className="px-3 py-3 text-center font-semibold">Pontos</th>
            <th className="px-3 py-3 text-left font-semibold">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {palpites.map((p) => {
            const Icone = ICONES[p.motivo];
            const temPontos = (p.pontos ?? 0) > 0;
            return (
              <tr
                key={p.id}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-3 py-3 font-medium">{p.apelido}</td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {p.palpite_casa} × {p.palpite_fora}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-block min-w-8 rounded-md px-2 py-0.5 text-xs font-bold ${
                      temPontos
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.pontos ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-1.5">
                    <Icone
                      className="h-4 w-4 shrink-0"
                      title={p.detalhe}
                      aria-label={p.detalhe}
                    />
                    <span className="text-muted-foreground">
                      {LABELS[p.motivo]}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `auditoria-log.tsx`**

Criar `src/components/admin/auditoria-log.tsx`:

```tsx
import type { EntradaLog } from "@/lib/auditoria/log";

const BADGE_COR: Record<string, string> = {
  salvar_placar:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sync_placar_auto:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  disparar_sync: "bg-muted text-muted-foreground",
  alterar_config:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const BADGE_LABEL: Record<string, string> = {
  salvar_placar: "Placar manual",
  sync_placar_auto: "Sync auto",
  disparar_sync: "Sync manual",
  alterar_config: "Config",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditoriaLog({ entradas }: { entradas: EntradaLog[] }) {
  if (entradas.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Nenhuma ação registrada ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {entradas.map((e) => (
        <li
          key={e.id}
          className="rounded-xl border border-border bg-card p-3 text-sm"
        >
          <div className="flex flex-wrap items-start gap-2">
            <time className="shrink-0 tabular-nums text-muted-foreground">
              {formatarData(e.criado_em)}
            </time>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                BADGE_COR[e.acao] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {BADGE_LABEL[e.acao] ?? e.acao}
            </span>
            <span className="flex-1">{e.descricao}</span>
          </div>
          {(e.dados_anteriores || e.dados_novos) && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">detalhes</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(
                  { antes: e.dados_anteriores, depois: e.dados_novos },
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Rodar os testes para confirmar que passam**

```
npm test -- src/components/admin/__tests__/auditoria-palpites.test.tsx
```

Esperado: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/auditoria-palpites.tsx src/components/admin/__tests__/auditoria-palpites.test.tsx src/components/admin/auditoria-log.tsx
git commit -m "feat: componentes AuditoriaPalpites e AuditoriaLog com testes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Página `/admin/auditoria` + link no admin + enriquecimento do `salvar_placar`

**Files:**
- Create: `src/app/admin/auditoria/page.tsx`
- Modify: `src/app/admin/page.tsx` — adicionar link "Auditoria"
- Modify: `src/app/admin/actions.ts` — incluir `time_casa`/`time_fora` em `dados_novos`

**Interfaces:**
- Consumes: `listarJogos`, `listarPalpitesJogo`, `listarLog`, `AuditoriaPalpites`, `AuditoriaLog`, `requireAdmin`

- [ ] **Step 1: Criar a página de auditoria**

Criar `src/app/admin/auditoria/page.tsx`:

```tsx
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/admin";
import { listarJogos } from "@/lib/matches";
import { listarPalpitesJogo } from "@/lib/auditoria/palpites";
import { listarLog } from "@/lib/auditoria/log";
import { AuditoriaPalpites } from "@/components/admin/auditoria-palpites";
import { AuditoriaLog } from "@/components/admin/auditoria-log";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ jogo?: string }>;
}) {
  await requireAdmin();
  const { jogo } = await searchParams;

  const [jogosFinalizados, palpites, entradas] = await Promise.all([
    listarJogos({ soEncerrados: true }),
    jogo ? listarPalpitesJogo(jogo) : Promise.resolve([]),
    listarLog(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <p className="mb-1 text-sm text-muted-foreground">
            <a href="/admin" className="hover:underline">
              Admin
            </a>
            {" / "}
            <span>Auditoria</span>
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Auditoria
          </h1>
        </div>

        <section className="mb-10">
          <h2 className="font-display mb-4 text-xl font-bold uppercase tracking-tight">
            Palpites por Jogo
          </h2>
          <form method="GET" className="mb-4 flex flex-wrap gap-2">
            <select
              name="jogo"
              defaultValue={jogo ?? ""}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um jogo...</option>
              {jogosFinalizados.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.time_casa} × {j.time_fora}
                  {j.placar_casa != null
                    ? ` — ${j.placar_casa}×${j.placar_fora}`
                    : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Ver
            </button>
          </form>
          <AuditoriaPalpites palpites={palpites} />
        </section>

        <hr className="mb-10 border-border" />

        <section>
          <h2 className="font-display mb-4 text-xl font-bold uppercase tracking-tight">
            Log de Ações
          </h2>
          <AuditoriaLog entradas={entradas} />
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar link "Auditoria" no `/admin/page.tsx`**

Em `src/app/admin/page.tsx`, linha 24 (ao lado do link "Configurações"), adicionar antes do `<a href="/admin/config"`:

```tsx
<a href="/admin/auditoria" className={buttonVariants("ghost", "sm")}>
  Auditoria
</a>
```

O bloco de links deve ficar:

```tsx
<div className="flex items-center gap-2">
  <a href="/admin/auditoria" className={buttonVariants("ghost", "sm")}>
    Auditoria
  </a>
  <a href="/admin/config" className={buttonVariants("ghost", "sm")}>
    Configurações
  </a>
  <form action={handleDispararSync}>
    <Button type="submit" variant="primary" size="sm">
      Sincronizar agora
    </Button>
  </form>
</div>
```

- [ ] **Step 3: Enriquecer `salvar_placar` em `actions.ts` com nomes dos times**

Em `src/app/admin/actions.ts`, modificar a linha do `select` (linha 27):

```ts
// ANTES:
.select("id, placar_casa, placar_fora, status")

// DEPOIS:
.select("id, placar_casa, placar_fora, status, time_casa, time_fora")
```

E na chamada de `registrar_acao_admin` (linha 50-57), enriquecer `p_dados_novos`:

```ts
// ANTES:
p_dados_novos: { placar_casa: casa, placar_fora: fora, status: "finalizado" },

// DEPOIS:
p_dados_novos: {
  placar_casa: casa,
  placar_fora: fora,
  status: "finalizado",
  time_casa: jogoAtual.time_casa,
  time_fora: jogoAtual.time_fora,
},
```

- [ ] **Step 4: Rodar build para garantir que não há erros de tipo**

```
npm run build
```

Esperado: Build completo sem erros de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/auditoria/page.tsx src/app/admin/page.tsx src/app/admin/actions.ts
git commit -m "feat: página /admin/auditoria e link no header admin

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Edge Function — audit logging de mudanças de placar automáticas

**Files:**
- Modify: `supabase/functions/sync-matches/index.ts`

**Interfaces:**
- Consumes: `MatchRow` de `../_shared/fixtures.ts` (já tem `time_casa`, `time_fora`, `placar_casa`, `placar_fora`)
- Produces: entradas em `audit_log` com `acao = "sync_placar_auto"` após cada upsert bem-sucedido com mudança de placar

**Notas de implementação:**
- A busca dos placares existentes deve ocorrer ANTES do upsert (para capturar o estado anterior)
- Somente registra mudanças em registros já existentes (se `api_fixture_id` não estava no banco = novo jogo, não há "antes")
- Somente registra quando `placar_casa` e `placar_fora` novos são não-nulos
- Usa `supabase.from("audit_log").insert(...)` diretamente com service_role (sem `registrar_acao_admin`, pois não há `auth.uid()`)

- [ ] **Step 1: Substituir o bloco do upsert em `sync-matches/index.ts`**

Localizar o bloco que começa em `if (paraUpsert.length > 0) {` (linhas 114–125) e substituir por:

```ts
if (paraUpsert.length > 0) {
  // Busca placares atuais ANTES do upsert para detectar mudanças
  const apiIds = paraUpsert.map((r) => r.api_fixture_id);
  const { data: existentes } = await supabase
    .from("matches")
    .select("id, api_fixture_id, placar_casa, placar_fora, time_casa, time_fora")
    .in("api_fixture_id", apiIds);

  const mapaExistentes = new Map(
    (existentes ?? []).map((m) => [
      m.api_fixture_id as string,
      {
        id: m.id as string,
        placar_casa: m.placar_casa as number | null,
        placar_fora: m.placar_fora as number | null,
        time_casa: m.time_casa as string,
        time_fora: m.time_fora as string,
      },
    ])
  );

  const { error } = await supabase
    .from("matches")
    .upsert(paraUpsert, { onConflict: "api_fixture_id" });

  if (error) {
    console.error(JSON.stringify({ evento: "sync_upsert_erro", mensagem: error.message }));
    return new Response(JSON.stringify({ ok: false, erro: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Detecta e registra mudanças de placar no audit_log
  const mudancas = paraUpsert
    .filter((r) => {
      const ex = mapaExistentes.get(r.api_fixture_id);
      if (!ex) return false; // novo jogo — sem estado anterior
      return (
        r.placar_casa != null &&
        r.placar_fora != null &&
        (ex.placar_casa !== r.placar_casa || ex.placar_fora !== r.placar_fora)
      );
    })
    .map((r) => {
      const ex = mapaExistentes.get(r.api_fixture_id)!;
      return {
        match_id: ex.id,
        time_casa: r.time_casa ?? ex.time_casa,
        time_fora: r.time_fora ?? ex.time_fora,
        anterior_casa: ex.placar_casa,
        anterior_fora: ex.placar_fora,
        novo_casa: r.placar_casa,
        novo_fora: r.placar_fora,
      };
    });

  if (mudancas.length > 0) {
    await supabase.from("audit_log").insert(
      mudancas.map((m) => ({
        user_id: null,
        acao: "sync_placar_auto",
        tabela: "matches",
        registro_id: m.match_id,
        dados_anteriores: {
          placar_casa: m.anterior_casa,
          placar_fora: m.anterior_fora,
        },
        dados_novos: {
          placar_casa: m.novo_casa,
          placar_fora: m.novo_fora,
          time_casa: m.time_casa,
          time_fora: m.time_fora,
        },
      }))
    );
  }
}
```

- [ ] **Step 2: Verificar que o arquivo compila (TypeScript do Deno)**

```
npm run build
```

Esperado: Build completo. A Edge Function usa Deno — o build do Next.js não compila ela, mas erros de import na função seriam visíveis. Verificar visualmente se os tipos de `MatchRow` (que tem `time_casa`, `time_fora`) são usados corretamente.

- [ ] **Step 3: Rodar todos os testes para confirmar que nada quebrou**

```
npm test
```

Esperado: PASS em todos os testes (sem regressões).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-matches/index.ts
git commit -m "feat: registrar mudanças de placar automáticas no audit_log

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura da spec:**
- ✅ Rota `/admin/auditoria` — Task 4
- ✅ Server Component com `searchParams` — Task 4
- ✅ `motivoPalpite()` com 5 níveis — Task 1
- ✅ `listarPalpitesJogo()` com UUID validation e LIMIT 200 — Task 1
- ✅ `formatarDescricaoLog()` com 4 tipos de ação — Task 2
- ✅ `listarLog()` com LIMIT 50 — Task 2
- ✅ `AuditoriaPalpites` — tabela com badge, ícone, `title` tooltip — Task 3
- ✅ `AuditoriaLog` — lista com badge colorido, `<details>` JSON — Task 3
- ✅ Link "Auditoria" no `/admin` — Task 4
- ✅ Enriquecimento de `salvar_placar` com team names — Task 4
- ✅ Edge Function: detecção e log de mudanças de placar — Task 5
- ✅ `SUPABASE_SERVICE_ROLE_KEY` via `createAdminClient()` — Task 1
- ✅ `requireAdmin()` como primeira operação na página — Task 4
- ✅ Nenhuma nova dependência npm — confirmado

**RLS Note:** `predictions` tem RLS restrito ao próprio usuário. `createAdminClient()` usa `service_role` para bypass autorizado, protegido por `requireAdmin()` na camada da página.
