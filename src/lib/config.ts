import { createClient } from "@/lib/supabase/server";

export type ConfigRow = { chave: string; valor: number };

export async function listarConfig(): Promise<ConfigRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_config")
      .select("chave, valor")
      .order("chave");
    return (data as ConfigRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function salvarConfig(chave: string, valor: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_config")
    .update({ valor })
    .eq("chave", chave);
  if (error) throw new Error(error.message);
}
