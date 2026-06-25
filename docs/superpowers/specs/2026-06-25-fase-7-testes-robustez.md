# Cravou! — Fase 7 — Testes & Robustez — Design / Spec

- **Data:** 2026-06-25
- **Status:** Aprovado (design)
- **Contexto:** Fases 0–6 completas e no ar. Copa do Mundo 2026 em andamento. Esta fase fecha o MVP com segurança verificável, resiliência no sync e controle operacional pelo admin.

## 1. Objetivo

Três frentes independentes:

1. **Testes de RLS (pgTAP)** — verificar formalmente que as políticas de Row-Level Security isolam dados entre usuários e protegem tabelas críticas.
2. **sync-matches robusto** — adicionar timeout, exponential backoff e logging estruturado à Edge Function de sincronização.
3. **Painel admin de configuração** — subpágina `/admin/config` para editar todos os valores de `app_config` com validação, feedback e recálculo automático de pontuação.

---

## 2. Frente 1 — Testes de RLS (pgTAP)

### 2.1 Arquivos

- `supabase/tests/rls_predictions.test.sql`
- `supabase/tests/rls_matches.test.sql`

### 2.2 Execução

```bash
supabase test db
```

Os testes rodam em transação (`BEGIN` / `ROLLBACK`) e não persistem dados no banco.

### 2.3 Simulação de usuários

Cada teste simula um usuário autenticado via:

```sql
select set_config('request.jwt.claims',
  '{"sub": "<uuid>", "role": "authenticated"}', true);
set local role authenticated;
```

Fixtures inseridas antes de trocar o papel, com `role postgres` (bypassa RLS). UUIDs fixos definidos como variáveis no início do arquivo.

### 2.4 `rls_predictions.test.sql` — cobertura

| # | Cenário | Resultado esperado |
|---|---------|-------------------|
| 1 | Usuário A: SELECT em suas próprias predictions | retorna suas linhas |
| 2 | Usuário A: SELECT em predictions de B | retorna 0 linhas |
| 3 | Usuário A: INSERT com `user_id` = A | sucesso |
| 4 | Usuário A: INSERT com `user_id` = B | falha (violação de política) |
| 5 | Usuário A: UPDATE em prediction própria | sucesso |
| 6 | Usuário A: UPDATE em prediction de B | 0 linhas afetadas |
| 7 | Usuário anônimo: SELECT em qualquer prediction | retorna 0 linhas |

### 2.5 `rls_matches.test.sql` — cobertura

| # | Tabela/View | Operação | Papel | Resultado esperado |
|---|-------------|----------|-------|-------------------|
| 1 | `matches` | SELECT | authenticated | retorna linhas |
| 2 | `matches` | INSERT | authenticated | falha |
| 3 | `matches` | UPDATE | authenticated | 0 linhas afetadas |
| 4 | `matches` | DELETE | authenticated | 0 linhas afetadas |
| 5 | `ranking` | SELECT | authenticated | retorna linhas |
| 6 | `ranking` | SELECT | anon | retorna 0 linhas ou falha |
| 7 | `app_config` | SELECT | authenticated | retorna linhas |
| 8 | `app_config` | UPDATE | authenticated | 0 linhas afetadas |
| 9 | `matches` | SELECT | anon | retorna 0 linhas |

### 2.6 Estrutura de cada arquivo

```sql
begin;
select plan(N);  -- N = número de asserções

-- fixtures (role postgres)
set local role postgres;
insert into public.profiles ...;
insert into public.matches ...;
insert into public.predictions ...;

-- testes por bloco de papel
-- ... asserções pgTAP (is, isnt, results_eq, throws_ok, etc.)

select * from finish();
rollback;
```

---

## 3. Frente 2 — sync-matches: Timeout + Exponential Backoff

### 3.1 Arquivo modificado

`supabase/functions/sync-matches/index.ts`

### 3.2 Helper `withRetry`

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  tentativas = 3,
): Promise<T> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      if (i < tentativas - 1) {
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
        // delays: 100ms → 200ms (para tentativas=3, cap 200ms)
      }
    }
  }
  throw ultimoErro;
}
```

### 3.3 Timeout por requisição

```ts
async function fsGet(path: string): Promise<unknown[]> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(url, {
        headers: { ... },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`FlashScore ${path} ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } finally {
      clearTimeout(timer);
    }
  });
}
```

### 3.4 Logging estruturado

No catch do handler principal, substituir `String(e)` por:

```ts
const erro = {
  mensagem: e instanceof Error ? e.message : String(e),
  stack: e instanceof Error ? e.stack : undefined,
};
console.error(JSON.stringify({ evento: "sync_erro", ...erro }));
return new Response(JSON.stringify({ ok: false, erro: erro.mensagem }), {
  status: 502,
  headers: { "Content-Type": "application/json" },
});
```

### 3.5 O que não muda

- Lógica de upsert e deduplicação por `api_fixture_id`
- Proteção de jogos com `placar_manual = true`
- Formato da resposta de sucesso: `{ ok, total, upserted, pulados_manual }`
- Autenticação via `x-cron-secret`

### 3.6 Testes

Sem testes unitários para a Edge Function — o retry é simples demais para justificar mockar o Deno runtime. Comportamento verificado via logs da Edge Function no painel Supabase.

---

## 4. Frente 3 — Painel Admin de Configuração

### 4.1 Arquivos

**Criar:**
- `src/lib/config.ts` — acesso a dados de `app_config`
- `src/app/admin/config/page.tsx` — subpágina server component
- `src/app/admin/config/actions.ts` — Server Action `salvarConfiguracoes`
- `src/components/admin/config-form.tsx` — formulário client component
- `src/components/admin/__tests__/config-form.test.tsx`

**Modificar:**
- `src/app/admin/page.tsx` — link "Configurações" na barra de cabeçalho do admin

### 4.2 Acesso a dados — `src/lib/config.ts`

```ts
export type ConfigRow = { chave: string; valor: number };

export async function listarConfig(): Promise<ConfigRow[]>
// SELECT chave, valor FROM app_config ORDER BY chave

export async function salvarConfig(chave: string, valor: number): Promise<void>
// UPDATE app_config SET valor = $valor WHERE chave = $chave
```

### 4.3 Server Action — `src/app/admin/config/actions.ts`

Assinatura: `salvarConfiguracoes(prevState, formData: FormData)`

Retorno: `{ ok: string } | { erro: string }`

**Validação (antes de qualquer escrita):**
- Todos os 5 campos presentes e parseáveis como inteiro
- Todos os valores ≥ 0
- `pts_placar_exato ≥ pts_saldo ≥ pts_resultado ≥ pts_gols_time` (hierarquia decrescente)
- `minutos_corte ≥ 1`

**Fluxo de escrita:**
1. Para cada chave, comparar valor novo com atual (lido no início da action)
2. Salvar apenas os que mudaram via `salvarConfig`
3. Se qualquer `pts_*` mudou: buscar todos os `matches` com `status = 'finalizado'` e chamar `recalcular_pontos(id)` para cada um (via `supabase.rpc`)
4. Retornar `{ ok: "Configurações salvas!" }` ou, se pontos recalculados, `{ ok: "Configurações salvas — pontos recalculados." }`

### 4.4 Campos do formulário

| Chave | Label PT-BR | Hint |
|-------|-------------|------|
| `minutos_corte` | Corte (min antes do jogo) | Palpites encerram X min antes do início |
| `pts_placar_exato` | Placar exato (pts) | Casa e fora corretos |
| `pts_saldo` | Saldo + vencedor (pts) | Vitória com diferença de gols exata |
| `pts_resultado` | Resultado V/E/D (pts) | Acertou quem ganhou ou empatou |
| `pts_gols_time` | Gols de um time (pts) | Acertou só os gols de um lado |

### 4.5 Componente — `src/components/admin/config-form.tsx`

- `"use client"`, `useActionState(salvarConfiguracoes, null)`
- Campos `<input type="number" min="0" step="1">` com `defaultValue` dos valores atuais
- `useToast()` + `useEffect` observando o estado: toast de sucesso ou erro
- Botão "Salvar configurações" desabilitado durante `pending`
- Erro de validação exibido inline (abaixo dos campos), não só como toast

### 4.6 Página — `src/app/admin/config/page.tsx`

```tsx
export default async function AdminConfigPage() {
  await requireAdmin();
  const config = await listarConfig();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 ...>Configurações</h1>
        <ConfigForm config={config} />
      </main>
    </div>
  );
}
```

### 4.7 Navegação

Na página `/admin`, adicionar ao cabeçalho um link "Configurações" (`buttonVariants("ghost", "sm")`) ao lado do botão "Sincronizar agora", apontando para `/admin/config`.

### 4.8 Testes — `config-form.test.tsx`

Cobertura mínima:
1. Renderiza os 5 campos com os valores iniciais passados via props
2. Exibe erro inline quando `pts_saldo > pts_placar_exato` (hierarquia violada) — sem submeter
3. Chama a action e exibe toast de sucesso quando `estado.ok` está presente
4. Exibe toast de erro quando `estado.erro` está presente

---

## 5. Fora de escopo (YAGNI)

- Testes de RLS para `profiles` (perfis são públicos por design — usuários veem o apelido/avatar de todos para o ranking)
- Histórico de alterações em `app_config` (audit log)
- Visualização de logs do sync-matches dentro do painel admin
- Notificação push quando a sync falha
- Retry com circuit breaker persistente na Edge Function
- Validação de faixa máxima dos valores de pontos (não há limite superior definido)

---

## 6. Convenções e restrições

- pgTAP: todos os testes em transação com `BEGIN` / `ROLLBACK`; UUIDs fixos definidos como `\set` no topo do arquivo
- Edge Functions: Deno runtime; secrets via `Deno.env.get()`; nunca expor `SUPABASE_SERVICE_ROLE_KEY` no client
- Next.js App Router: server actions com `"use server"`; client components com `"use client"`
- Tailwind v4: tokens via `@theme inline`; sem `tailwind.config`
- Ícones: lucide-react (nunca emoji)
- Mensagens de commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
