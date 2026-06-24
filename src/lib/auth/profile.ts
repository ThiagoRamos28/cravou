import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  apelido: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

export async function getSessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

export async function getPerfil(): Promise<Profile | null> {
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
}
