"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoRedefinir = { erro?: string };

export async function redefinirSenha(
  _prev: EstadoRedefinir,
  formData: FormData
): Promise<EstadoRedefinir> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (senha.length < 6) return { erro: "A senha deve ter pelo menos 6 caracteres." };
  if (senha !== confirmar) return { erro: "As senhas não coincidem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível atualizar a senha. Solicite um novo link." };

  redirect("/jogos");
}
