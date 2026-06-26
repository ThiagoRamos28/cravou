"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

const SYNC_COOLDOWN_MS = 60_000; // 60 segundos entre disparos manuais

export async function salvarPlacar(
  _prev: { erro?: string; ok?: string },
  formData: FormData
): Promise<{ erro?: string; ok?: string }> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const casa = Number(formData.get("placar_casa"));
  const fora = Number(formData.get("placar_fora"));
  if (!id || Number.isNaN(casa) || Number.isNaN(fora) || casa < 0 || fora < 0) {
    return { erro: "Informe um placar válido (números ≥ 0)." };
  }

  const supabase = await createClient();

  // Valida que o jogo existe e captura estado anterior para audit
  const { data: jogoAtual, error: erroConsulta } = await supabase
    .from("matches")
    .select("id, placar_casa, placar_fora, status")
    .eq("id", id)
    .single();

  if (erroConsulta || !jogoAtual) return { erro: "Jogo não encontrado." };

  const { error } = await supabase
    .from("matches")
    .update({
      placar_casa: casa,
      placar_fora: fora,
      status: "finalizado",
      placar_manual: true,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { erro: "Não foi possível salvar o placar." };

  // Registra a alteração na trilha de auditoria
  await supabase.rpc("registrar_acao_admin", {
    p_acao: "salvar_placar",
    p_tabela: "matches",
    p_registro_id: id,
    p_dados_anteriores: {
      placar_casa: jogoAtual.placar_casa,
      placar_fora: jogoAtual.placar_fora,
      status: jogoAtual.status,
    },
    p_dados_novos: { placar_casa: casa, placar_fora: fora, status: "finalizado" },
  });

  revalidatePath("/admin");
  revalidatePath("/jogos");
  return { ok: "Placar salvo." };
}

export async function dispararSync(): Promise<{ erro?: string; ok?: string }> {
  await requireAdmin();

  const url = process.env.SYNC_FUNCTION_URL;
  const segredo = process.env.CRON_SECRET;
  if (!url || !segredo) return { erro: "Sync não configurada." };

  const supabase = await createClient();

  // Cooldown: impede disparos com menos de 60s de intervalo
  const { data: ultimoSync } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "ultimo_sync_unix")
    .single();

  if (ultimoSync) {
    const decorrido = Date.now() - ultimoSync.valor * 1000;
    if (decorrido < SYNC_COOLDOWN_MS) {
      const restante = Math.ceil((SYNC_COOLDOWN_MS - decorrido) / 1000);
      return { erro: `Aguarde ${restante}s antes de sincronizar novamente.` };
    }
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": segredo },
  });
  if (!resp.ok) return { erro: `Falha na sync (${resp.status}).` };

  // Atualiza timestamp e registra auditoria
  await Promise.all([
    supabase.from("app_config").upsert({
      chave: "ultimo_sync_unix",
      valor: Math.floor(Date.now() / 1000),
    }),
    supabase.rpc("registrar_acao_admin", { p_acao: "disparar_sync" }),
  ]);

  revalidatePath("/jogos");
  return { ok: "Sincronização disparada." };
}
