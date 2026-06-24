"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

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
  revalidatePath("/admin");
  revalidatePath("/jogos");
  return { ok: "Placar salvo." };
}

export async function dispararSync(): Promise<{ erro?: string; ok?: string }> {
  await requireAdmin();
  const url = process.env.SYNC_FUNCTION_URL;
  const segredo = process.env.CRON_SECRET;
  if (!url || !segredo) return { erro: "Sync não configurada." };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": segredo },
  });
  if (!resp.ok) return { erro: `Falha na sync (${resp.status}).` };
  revalidatePath("/jogos");
  return { ok: "Sincronização disparada." };
}
