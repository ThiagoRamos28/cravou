"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilSchema, atualizarSenhaSchema, validar } from "@/lib/auth/validation";

export type EstadoPerfil = { sucesso?: boolean; erro?: string };

export async function atualizarApelido(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(perfilSchema.pick({ apelido: true }), {
    apelido: formData.get("apelido"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ apelido: v.dados.apelido })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/perfil");
  return { sucesso: true };
}

export async function atualizarAvatar(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(perfilSchema.pick({ avatar_url: true }), {
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
    .update({ avatar_url: v.dados.avatar_url })
    .eq("id", user.id);

  if (error) return { erro: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/perfil");
  return { sucesso: true };
}

export async function atualizarSenha(
  _prev: EstadoPerfil,
  formData: FormData
): Promise<EstadoPerfil> {
  const v = validar(atualizarSenhaSchema, {
    senha_atual: formData.get("senha_atual"),
    senha_nova: formData.get("senha_nova"),
    confirmar: formData.get("confirmar"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // signInWithPassword verifica a senha atual; como efeito colateral, rotaciona os cookies da sessão.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: v.dados.senha_atual,
  });
  if (authError) return { erro: "Senha atual incorreta." };

  const { error: updateError } = await supabase.auth.updateUser({
    password: v.dados.senha_nova,
  });
  if (updateError) return { erro: "Não foi possível alterar a senha. Tente novamente." };

  return { sucesso: true };
}
