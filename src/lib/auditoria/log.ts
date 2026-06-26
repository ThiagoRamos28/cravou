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

    const { data: logData, error } = await supabase
      .from("audit_log")
      .select("id, criado_em, acao, user_id, dados_anteriores, dados_novos")
      .order("criado_em", { ascending: false })
      .limit(50);

    if (error || !logData || logData.length === 0) return [];
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
