"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilSchema, validar } from "@/lib/auth/validation";

export async function salvarPerfil(
  _prev: { erro?: string },
  formData: FormData
): Promise<{ erro?: string }> {
  const v = validar(perfilSchema, {
    apelido: formData.get("apelido"),
    avatar_url: formData.get("avatar_url"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ apelido: v.dados.apelido, avatar_url: v.dados.avatar_url })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  redirect("/");
}
