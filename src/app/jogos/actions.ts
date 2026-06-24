"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validar } from "@/lib/auth/validation";
import { palpiteSchema } from "@/lib/palpites/validation";
import { palpiteAberto } from "@/lib/palpites/corte";
import { getMinutosCorte } from "@/lib/predictions";

export type EstadoPalpite = { erro?: string; ok?: string };

export async function salvarPalpite(
  _prev: EstadoPalpite,
  formData: FormData
): Promise<EstadoPalpite> {
  const matchId = String(formData.get("match_id") ?? "");
  const inicioEm = String(formData.get("inicio_em") ?? "");
  if (!matchId || !inicioEm) return { erro: "Jogo inválido." };

  const v = validar(palpiteSchema, {
    palpite_casa: formData.get("palpite_casa"),
    palpite_fora: formData.get("palpite_fora"),
  });
  if (!v.sucesso) return { erro: v.erro };

  // Pré-checagem amigável (a RLS é a fonte da verdade).
  const minutosCorte = await getMinutosCorte();
  if (!palpiteAberto(inicioEm, minutosCorte)) {
    return { erro: "O prazo para palpitar neste jogo já encerrou." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login para palpitar." };

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      palpite_casa: v.dados.palpite_casa,
      palpite_fora: v.dados.palpite_fora,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );

  // Se a RLS barrar (corte/limite), o erro cai aqui.
  if (error) return { erro: "Não foi possível salvar o palpite." };

  revalidatePath("/jogos");
  return { ok: "Palpite salvo!" };
}
