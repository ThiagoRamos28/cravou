# Cravou! — Auditoria Admin — Design / Spec

- **Data:** 2026-06-26
- **Status:** Aprovado (design)
- **Contexto:** Durante a Copa 2026 surgiram dúvidas sobre pontuações ("por que o Dannilo ganhou X pontos?"). O admin precisa de uma página que mostre palpites × placar de forma transparente e registre o histórico de todas as alterações de placar — manuais e automáticas.

---

## 1. Visão geral

Nova rota `/admin/auditoria` (Server Component, somente leitura) com duas seções:

1. **Palpites por jogo** — seleciona um jogo finalizado, exibe todos os palpites com pontuação e explicação do motivo.
2. **Log de ações** — histórico cronológico reverso das últimas 50 alterações: manuais (admin) e automáticas (sync da API).

Linkado no cabeçalho do `/admin` ao lado de "Configurações".

### Fora de escopo
- Edição/override de pontos individuais (leitura apenas).
- Paginação do log além de 50 entradas (suficiente para o grupo fechado).
- Filtros ou busca no log.

---

## 2. Arquitetura

### 2.1 Rota e página

```
src/
  app/
    admin/
      auditoria/
        page.tsx        # Server Component — recebe searchParams: { jogo?: string }
  lib/
    auditoria/
      palpites.ts       # listarPalpitesJogo(matchId: string): Promise<PalpiteAuditado[]>
      log.ts            # listarLog(): Promise<EntradaLog[]>
  components/
    admin/
      auditoria-palpites.tsx  # tabela de palpites (client p/ tooltip)
      auditoria-log.tsx       # lista do log (server, sem estado)
```

`page.tsx` chama `requireAdmin()` como primeira operação antes de ler `searchParams`.

### 2.2 Tipos

```ts
// lib/auditoria/palpites.ts
export type MotivoNivel =
  | "exato"        // 10 pts — placar exato
  | "saldo"        // 7 pts  — vencedor certo + diferença de gols exata
  | "resultado"    // 5 pts  — V/E/D correto
  | "gols"         // 2 pts  — errou resultado, acertou gols de um time
  | "erro";        // 0 pts

export type PalpiteAuditado = {
  id: string;
  apelido: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  motivo: MotivoNivel;
  detalhe: string; // texto do tooltip, ex: "Acertou os gols do time de fora (2)"
};

// lib/auditoria/log.ts
export type EntradaLog = {
  id: string;
  criado_em: string;
  acao: string;
  apelido_admin: string | null; // null = sync automático (user_id null)
  descricao: string;            // texto formatado para exibição
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
};
```

---

## 3. Módulos de dados

### 3.1 `listarPalpitesJogo`

Busca via Supabase client server-side:

```sql
SELECT p.id, pr.apelido, p.palpite_casa, p.palpite_fora, p.pontos,
       m.placar_casa, m.placar_fora
FROM predictions p
JOIN profiles pr ON pr.id = p.user_id
JOIN matches m ON m.id = p.match_id
WHERE p.match_id = $1          -- UUID validado
LIMIT 200
```

O motivo e o detalhe são calculados em TypeScript a partir dos valores retornados, reutilizando a mesma lógica de `lib/palpites/pontuacao.ts` (`pontuar()`) mas com uma função auxiliar `motivoPalpite()` que devolve `MotivoNivel` + string de detalhe.

**Validação do searchParam:** antes de qualquer query, `matchId` é validado com:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(matchId)) return [];
```

### 3.2 `listarLog`

```sql
SELECT al.id, al.criado_em, al.acao, al.dados_anteriores, al.dados_novos,
       pr.apelido
FROM audit_log al
LEFT JOIN profiles pr ON pr.id = al.user_id
ORDER BY al.criado_em DESC
LIMIT 50
```

A `descricao` é gerada em TypeScript por uma função `formatarDescricaoLog(entrada)` que interpreta `acao` e os campos JSONB:
- `salvar_placar` → "Turkey × USA: 2×1 → 3×2"
- `disparar_sync` → "Sync manual disparada"
- `sync_placar_auto` → "Sync automática: Turkey × USA 3×2"
- `alterar_config` → "Config pts_resultado: 5 → 7"

---

## 4. Edge Function — logging de sync automática

### 4.1 Objetivo
Registrar no `audit_log` cada jogo cujo placar mudou durante uma sync automática (via cron ou manual).

### 4.2 Implementação

Na Edge Function `sync-matches/index.ts`, após o `upsert` bem-sucedido:

1. **Antes do upsert:** buscar os placares atuais dos jogos que serão atualizados.
2. **Comparar:** identificar quais tiveram mudança em `placar_casa` ou `placar_fora`.
3. **Inserir no audit_log** via `service_role` (user_id = null, já permitido pelo schema):

```ts
await supabase.from("audit_log").insert(
  mudancas.map((m) => ({
    user_id: null,
    acao: "sync_placar_auto",
    tabela: "matches",
    registro_id: m.id,
    dados_anteriores: { placar_casa: m.anterior_casa, placar_fora: m.anterior_fora },
    dados_novos: { placar_casa: m.novo_casa, placar_fora: m.novo_fora,
                   time_casa: m.time_casa, time_fora: m.time_fora },
  }))
);
```

Jogos protegidos por `placar_manual = true` já são filtrados antes do upsert, portanto não aparecem como mudança automática.

---

## 5. Layout visual

### 5.1 Link no admin

Em `src/app/admin/page.tsx`, adicionar ao lado de "Configurações":
```tsx
<a href="/admin/auditoria" className={buttonVariants("ghost", "sm")}>
  Auditoria
</a>
```

### 5.2 Página `/admin/auditoria`

```
[Cravou! header]

Admin / Auditoria                          ← breadcrumb simples

─── Palpites por jogo ──────────────────────────────────────

[ Select: "Selecione um jogo..." ▾ ]   [Ver]

┌─────────────────────────────────────────────────────────┐
│ Apelido        │ Palpite │ Pontos │ Motivo              │
├─────────────────────────────────────────────────────────┤
│ Thirrasgu      │ 1 × 2   │  [2]   │ ⚽ Acertou gols…  │
│ Dannilo        │ 0 × 3   │  [0]   │ ✗ Errou tudo       │
│ Mandioca       │ 1 × 2   │  [2]   │ ⚽ Acertou gols…  │
└─────────────────────────────────────────────────────────┘

─── Log de ações ───────────────────────────────────────────

2026-06-26 11:45  [Sync auto]   Turkey × USA: — → 3×2
2026-06-25 14:02  [Placar manual]  Turkey × USA: 2×1 → 3×2  (por AdminNome)
                                   ▶ detalhes (dados JSON colapsados)
```

### 5.3 Componentes

**`AuditoriaPalpites`** (Server Component — tooltip via `title` nativo não requer JS):
- Tabela responsiva com `overflow-x-auto` no mobile.
- Badge de pontos: verde (`text-primary`) se > 0, cinza (`text-muted-foreground`) se 0.
- Ícone de motivo: `Trophy` (exato), `Target` (saldo), `CheckCircle` (resultado), `Circle` (gols), `X` (erro) — todos de `lucide-react`.
- Tooltip: atributo `title` HTML nativo no ícone com o texto de `detalhe`. Sem biblioteca de tooltip.

**`AuditoriaLog`** (Server Component):
- Lista `<ul>` com `<li>` por entrada.
- Badge de ação: cor diferente por tipo (`salvar_placar` = amarelo, `sync_placar_auto` = azul, `disparar_sync` = cinza, `alterar_config` = roxo).
- `<details><summary>detalhes</summary><pre>{JSON.stringify(dados, null, 2)}</pre></details>` para os dados JSONB — renderizado como texto, sem `dangerouslySetInnerHTML`.

---

## 6. Segurança

| Vetor | Proteção |
|---|---|
| Acesso não-admin | `requireAdmin()` antes de qualquer leitura de searchParams |
| SQL injection via `?jogo=` | Validação UUID v4 por regex antes da query; Supabase client usa queries parametrizadas |
| XSS via apelidos/JSONB | React escapa strings; `<pre>` com `JSON.stringify` — sem `dangerouslySetInnerHTML` |
| Disclosure de user_id no log | UI exibe só `apelido`, nunca o UUID do usuário |
| Queries pesadas | `LIMIT 200` em palpites, `LIMIT 50` no log |
| CSRF | Página somente leitura — sem formulários de escrita |
| Injection na Edge Function | Valores gravados no audit_log são internos da função, não de input externo |

---

## 7. Testes

- `lib/auditoria/palpites.ts` — teste unitário de `motivoPalpite()` cobrindo os 5 níveis (exato, saldo, resultado, gols, erro).
- `lib/auditoria/log.ts` — teste unitário de `formatarDescricaoLog()` cobrindo os 4 tipos de ação.
- `AuditoriaPalpites` — teste de componente: renderiza tabela com dados mockados, verifica badge e atributo `title` do ícone.
- Edge Function — teste de integração: mock do upsert com mudança de placar, verifica INSERT no audit_log.

---

## 8. Dependências e migrações

- **Nenhuma nova tabela** — `audit_log` já existe.
- **Sem nova migração SQL** — a Edge Function insere diretamente com `service_role`; `user_id = null` já é permitido pelo schema.
- **Nenhuma nova dependência npm** — tooltips via `title` nativo; ícones via `lucide-react` já instalado.
