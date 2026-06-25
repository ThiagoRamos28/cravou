"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listarConfig, salvarConfig } from "@/lib/config";

const CHAVES_PTS = ["pts_placar_exato", "pts_saldo", "pts_resultado", "pts_gols_time"] as const;
const TODAS_CHAVES = ["minutos_corte", ...CHAVES_PTS] as const;
type Chave = (typeof TODAS_CHAVES)[number];

export async function salvarConfiguracoes(
  _prev: { ok?: string; erro?: string } | null,
  formData: FormData
): Promise<{ ok?: string; erro?: string }> {
  await requireAdmin();

  // 1. Parse
  const valores = {} as Record<Chave, number>;
  for (const chave of TODAS_CHAVES) {
    const val = parseInt(String(formData.get(chave) ?? ""), 10);
    if (Number.isNaN(val)) return { erro: `Valor inválido para ${chave}.` };
    valores[chave] = val;
  }

  // 2. Validação
  if (valores.minutos_corte < 1) return { erro: "Corte mínimo é 1 minuto." };
  if (CHAVES_PTS.some((k) => valores[k] < 0)) return { erro: "Pontos não podem ser negativos." };
  if (valores.pts_placar_exato < valores.pts_saldo)
    return { erro: "Placar exato deve valer ≥ saldo+vencedor." };
  if (valores.pts_saldo < valores.pts_resultado)
    return { erro: "Saldo+vencedor deve valer ≥ resultado V/E/D." };
  if (valores.pts_resultado < valores.pts_gols_time)
    return { erro: "Resultado V/E/D deve valer ≥ gols de um time." };

  // 3. Carregar valores atuais para detectar mudanças
  const atuais = await listarConfig();
  const mapaAtual = Object.fromEntries(atuais.map((r) => [r.chave, r.valor]));

  // 4. Salvar apenas o que mudou
  try {
    for (const chave of TODAS_CHAVES) {
      if (mapaAtual[chave] !== valores[chave]) {
        await salvarConfig(chave, valores[chave]);
      }
    }
  } catch {
    return { erro: "Não foi possível salvar as configurações." };
  }

  // 5. Recalcular se algum pts_* mudou
  const ptsMudou = CHAVES_PTS.some((k) => mapaAtual[k] !== valores[k]);
  if (ptsMudou) {
    try {
      const supabase = await createClient();
      await supabase.rpc("recalcular_todos");
    } catch {
      revalidatePath("/admin/config");
      return { ok: "Configurações salvas. Recálculo de pontos falhou — tente salvar novamente." };
    }
    revalidatePath("/ranking");
  }

  revalidatePath("/admin/config");
  return {
    ok: ptsMudou
      ? "Configurações salvas — pontos recalculados."
      : "Configurações salvas!",
  };
}
