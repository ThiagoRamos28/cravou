import { createClient } from "@/lib/supabase/server";
import { COOKIE_COMPETICAO, type Competicao } from "@/lib/competicoes-shared";

export type { Competicao };
export { COOKIE_COMPETICAO };

const COLS = "id, slug, nome, formato, ativa, ordem";

// Todas as competições, ordenadas por `ordem`. Falha aberta: [] em erro.
export async function listarCompeticoes(): Promise<Competicao[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("competicoes").select(COLS).order("ordem");
    return (data as Competicao[]) ?? [];
  } catch {
    return [];
  }
}

// Pura: ativas ∪ competições onde o usuário fez opt-in (por slug). Ordenada por `ordem`.
export function competicoesVisiveis(
  todas: Competicao[],
  slugsComOptIn: string[]
): Competicao[] {
  const set = new Set(slugsComOptIn);
  return todas
    .filter((c) => c.ativa || set.has(c.slug))
    .sort((a, b) => a.ordem - b.ordem);
}

// Pura: competição selecionada — cookie válido, senão ativa de maior ordem, senão a 1ª.
export function resolverCompeticao(
  todas: Competicao[],
  slugCookie: string | undefined
): Competicao | undefined {
  if (slugCookie) {
    const doCookie = todas.find((c) => c.slug === slugCookie);
    if (doCookie) return doCookie;
  }
  const ativas = todas.filter((c) => c.ativa).sort((a, b) => b.ordem - a.ordem);
  return ativas[0] ?? todas[0];
}

// Slugs de competições em que o usuário logado tem opt-in ativo. Falha aberta: [].
export async function meusOptIns(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("profiles_competicoes")
      .select("ativo, competicoes(slug)")
      .eq("user_id", user.id)
      .eq("ativo", true);
    return (
      (data as { competicoes: { slug: string } | null }[] | null) ?? []
    )
      .map((r) => r.competicoes?.slug)
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}
