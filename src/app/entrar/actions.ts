"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  credenciaisSchema,
  magicLinkSchema,
  validar,
} from "@/lib/auth/validation";

type EstadoAuth = { erro?: string; ok?: string };

export async function entrarComSenha(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(credenciaisSchema, {
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: v.dados.email,
    password: v.dados.senha,
  });
  if (error) return { erro: "E-mail ou senha incorretos." };

  redirect("/onboarding");
}

export async function cadastrar(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(credenciaisSchema, {
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!v.sucesso) return { erro: v.erro };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: v.dados.email,
    password: v.dados.senha,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { erro: "Não foi possível criar a conta. Tente outro e-mail." };

  return { ok: "Conta criada! Confirme pelo link que enviamos ao seu e-mail." };
}

export async function enviarMagicLink(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(magicLinkSchema, { email: formData.get("email") });
  if (!v.sucesso) return { erro: v.erro };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: v.dados.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { erro: "Não foi possível enviar o link. Tente novamente." };

  return { ok: "Enviamos um link de acesso para o seu e-mail." };
}

export async function solicitarRedefinicaoSenha(
  _prev: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const v = validar(magicLinkSchema, { email: formData.get("email") });
  if (!v.sucesso) return { erro: v.erro };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(v.dados.email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });
  if (error) return { erro: "Não foi possível enviar o link. Tente novamente." };

  return { ok: "Enviamos um link de redefinição para o seu e-mail." };
}
