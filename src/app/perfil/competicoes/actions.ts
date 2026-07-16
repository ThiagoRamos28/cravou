"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function alternarParticipacao(competicaoId: string, ativo: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Faça login." };

  const { error } = await supabase
    .from("profiles_competicoes")
    .upsert(
      { user_id: user.id, competicao_id: competicaoId, ativo },
      { onConflict: "user_id,competicao_id" }
    );

  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath("/perfil/competicoes");
  return { ok: true };
}
