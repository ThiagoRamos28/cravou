import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  apelido: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

export async function getSessao() {
  // Falha aberta: qualquer erro (config ausente, Supabase indisponível) vira "deslogado",
  // em vez de derrubar a página que chama isto.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

export async function getPerfil(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, apelido, avatar_url, is_admin")
      .eq("id", user.id)
      .single();

    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

export async function getPerfilPublico(id: string): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const sessao = await getSessao();
    if (!sessao) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, apelido, avatar_url, is_admin")
      .eq("id", id)
      .single();

    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}
