"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarPosts, type PostFeed } from "@/lib/feed";

export async function publicarPost(
  conteudo: string,
  jogoId?: string
): Promise<{ erro?: string }> {
  const texto = conteudo.trim();
  if (!texto) return { erro: "O post não pode estar vazio." };
  if (texto.length > 140) return { erro: "Máximo de 140 caracteres." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    conteudo: texto,
    jogo_id: jogoId ?? null,
  });

  if (error) return { erro: "Não foi possível publicar. Tente novamente." };

  revalidatePath("/feed");
  return {};
}

export async function alternarCurtida(postId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existe } = await supabase
    .from("post_curtidas")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existe) {
    await supabase
      .from("post_curtidas")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("post_curtidas")
      .insert({ post_id: postId, user_id: user.id });
  }
}

export async function alternarFollow(followingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === followingId) return;

  const { data: existe } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .single();

  if (existe) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: followingId });
  }

  revalidatePath(`/perfil/${followingId}`);
}

export async function deletarPost(
  postId: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado." };

  const { data: post } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post || (post as { user_id: string }).user_id !== user.id) {
    return { erro: "Você não pode deletar este post." };
  }

  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath("/feed");
  return {};
}

export async function carregarMaisPosts(
  offset: number,
  userId: string
): Promise<PostFeed[]> {
  return listarPosts(userId, offset);
}
