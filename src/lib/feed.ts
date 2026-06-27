import { createClient } from "@/lib/supabase/server";

export type PostFeed = {
  id: string;
  user_id: string;
  conteudo: string;
  created_at: string;
  jogo_id: string | null;
  curtidas: number;
  curtido_por_mim: boolean;
  autor: {
    apelido: string;
    avatar_url: string | null;
  };
  jogo: {
    time_casa: string;
    time_fora: string;
    bandeira_casa: string | null;
    bandeira_fora: string | null;
  } | null;
};

export type PerfilBasico = {
  id: string;
  apelido: string;
  avatar_url: string | null;
};

export type MetricasSociais = {
  seguidores: number;
  seguindo: number;
};

export type PalpiteResumido = {
  jogo_id: string;
  time_casa: string;
  time_fora: string;
  bandeira_casa: string | null;
  bandeira_fora: string | null;
  palpite_casa: number;
  palpite_fora: number;
  placar_casa: number | null;
  placar_fora: number | null;
  status: "agendado" | "ao_vivo" | "finalizado";
  pontos: number | null;
};

const POST_LIMIT = 20;

export async function listarPosts(
  userId: string,
  offset: number = 0
): Promise<PostFeed[]> {
  try {
    const supabase = await createClient();

    const { data: rows } = await supabase
      .from("posts")
      .select(
        "id, user_id, conteudo, created_at, jogo_id, " +
          "autor:profiles!posts_user_id_fkey(apelido, avatar_url), " +
          "jogo:matches(time_casa, time_fora, bandeira_casa, bandeira_fora)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + POST_LIMIT - 1);

    if (!rows || rows.length === 0) return [];

    type RawPost = {
      id: string;
      user_id: string;
      conteudo: string;
      created_at: string;
      jogo_id: string | null;
      autor: { apelido: string | null; avatar_url: string | null } | null;
      jogo: { time_casa: string; time_fora: string; bandeira_casa: string | null; bandeira_fora: string | null } | null;
    };
    const typedRows = rows as unknown as RawPost[];

    const postIds = typedRows.map((r) => r.id);

    const { data: curtidas } = await supabase
      .from("post_curtidas")
      .select("post_id, user_id")
      .in("post_id", postIds);

    const curtidasMap = new Map<string, { count: number; minha: boolean }>();
    for (const c of curtidas ?? []) {
      const entry = curtidasMap.get(c.post_id) ?? { count: 0, minha: false };
      entry.count++;
      if (c.user_id === userId) entry.minha = true;
      curtidasMap.set(c.post_id, entry);
    }

    return typedRows.map((r) => {
      const c = curtidasMap.get(r.id) ?? { count: 0, minha: false };
      return {
        id: r.id,
        user_id: r.user_id,
        conteudo: r.conteudo,
        created_at: r.created_at,
        jogo_id: r.jogo_id,
        curtidas: c.count,
        curtido_por_mim: c.minha,
        autor: {
          apelido: r.autor?.apelido ?? "Usuário",
          avatar_url: r.autor?.avatar_url ?? null,
        },
        jogo: r.jogo,
      };
    });
  } catch {
    return [];
  }
}

export async function listarPerfis(): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, apelido, avatar_url")
      .not("apelido", "is", null);
    return (data as unknown as PerfilBasico[]) ?? [];
  } catch {
    return [];
  }
}

export async function getMetricasSociais(
  profileId: string
): Promise<MetricasSociais> {
  try {
    const supabase = await createClient();
    const [{ count: seguidores }, { count: seguindo }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId),
    ]);
    return { seguidores: seguidores ?? 0, seguindo: seguindo ?? 0 };
  } catch {
    return { seguidores: 0, seguindo: 0 };
  }
}

export async function getSeguidores(profileId: string): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower:profiles!follows_follower_id_fkey(id, apelido, avatar_url)")
      .eq("following_id", profileId);
    return (data ?? []).map((r) => (r as unknown as { follower: PerfilBasico }).follower);
  } catch {
    return [];
  }
}

export async function getSeguindo(profileId: string): Promise<PerfilBasico[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("following:profiles!follows_following_id_fkey(id, apelido, avatar_url)")
      .eq("follower_id", profileId);
    return (data ?? []).map((r) => (r as unknown as { following: PerfilBasico }).following);
  } catch {
    return [];
  }
}

export async function getUltimosPalpites(
  profileId: string
): Promise<PalpiteResumido[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("predictions")
      .select(
        "palpite_casa, palpite_fora, pontos, " +
          "match:matches!predictions_match_id_fkey(" +
          "id, time_casa, time_fora, bandeira_casa, bandeira_fora, " +
          "placar_casa, placar_fora, status" +
          ")"
      )
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10);

    type RawPrediction = {
      palpite_casa: number;
      palpite_fora: number;
      pontos: number | null;
      match: {
        id: string;
        time_casa: string;
        time_fora: string;
        bandeira_casa: string | null;
        bandeira_fora: string | null;
        placar_casa: number | null;
        placar_fora: number | null;
        status: "agendado" | "ao_vivo" | "finalizado";
      };
    };
    return (data ?? []).map((r) => {
      const row = r as unknown as RawPrediction;
      const m = row.match;
      return {
        jogo_id: m.id,
        time_casa: m.time_casa,
        time_fora: m.time_fora,
        bandeira_casa: m.bandeira_casa,
        bandeira_fora: m.bandeira_fora,
        palpite_casa: row.palpite_casa,
        palpite_fora: row.palpite_fora,
        placar_casa: m.placar_casa,
        placar_fora: m.placar_fora,
        status: m.status,
        pontos: row.pontos,
      };
    });
  } catch {
    return [];
  }
}

export async function listarJogosParaComposer(): Promise<
  { id: string; time_casa: string; time_fora: string }[]
> {
  try {
    const supabase = await createClient();
    const limite = new Date();
    limite.setDate(limite.getDate() - 3);
    const { data } = await supabase
      .from("matches")
      .select("id, time_casa, time_fora")
      .gte("inicio_em", limite.toISOString())
      .order("inicio_em", { ascending: true })
      .limit(30);
    return (data ?? []) as { id: string; time_casa: string; time_fora: string }[];
  } catch {
    return [];
  }
}

export async function isSeguindo(
  followerId: string,
  followingId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export type UsuarioComFollow = PerfilBasico & { ja_sigo: boolean };

export type PalpiteAmigo = PalpiteResumido & {
  autor: { id: string; apelido: string; avatar_url: string | null };
  feito_em: string;
};

const PALPITE_LIMIT = 20;

export async function listarPalpitesAmigos(
  sessaoId: string,
  offset: number = 0
): Promise<PalpiteAmigo[]> {
  try {
    const supabase = await createClient();

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", sessaoId);

    const amigos = (follows ?? []).map((f) => f.following_id as string);
    if (amigos.length === 0) return [];

    const { data } = await supabase
      .from("predictions")
      .select(
        "palpite_casa, palpite_fora, pontos, created_at, " +
          "autor:profiles!predictions_user_id_fkey(id, apelido, avatar_url), " +
          "match:matches!predictions_match_id_fkey(" +
          "id, time_casa, time_fora, bandeira_casa, bandeira_fora, " +
          "placar_casa, placar_fora, status" +
          ")"
      )
      .in("user_id", amigos)
      .order("created_at", { ascending: false })
      .range(offset, offset + PALPITE_LIMIT - 1);

    type RawPA = {
      palpite_casa: number;
      palpite_fora: number;
      pontos: number | null;
      created_at: string;
      autor: { id: string; apelido: string | null; avatar_url: string | null } | null;
      match: {
        id: string;
        time_casa: string;
        time_fora: string;
        bandeira_casa: string | null;
        bandeira_fora: string | null;
        placar_casa: number | null;
        placar_fora: number | null;
        status: "agendado" | "ao_vivo" | "finalizado";
      };
    };

    return (data ?? []).map((r) => {
      const row = r as unknown as RawPA;
      const m = row.match;
      return {
        jogo_id: m.id,
        time_casa: m.time_casa,
        time_fora: m.time_fora,
        bandeira_casa: m.bandeira_casa,
        bandeira_fora: m.bandeira_fora,
        palpite_casa: row.palpite_casa,
        palpite_fora: row.palpite_fora,
        placar_casa: m.placar_casa,
        placar_fora: m.placar_fora,
        status: m.status,
        pontos: row.pontos,
        feito_em: row.created_at,
        autor: {
          id: row.autor?.id ?? "",
          apelido: row.autor?.apelido ?? "Usuário",
          avatar_url: row.autor?.avatar_url ?? null,
        },
      };
    });
  } catch {
    return [];
  }
}

export async function listarUsuarios(sessaoId: string): Promise<UsuarioComFollow[]> {
  try {
    const supabase = await createClient();

    const [{ data: perfis }, { data: seguindo }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, apelido, avatar_url")
        .not("apelido", "is", null)
        .neq("id", sessaoId)
        .order("apelido", { ascending: true }),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", sessaoId),
    ]);

    const seguindoSet = new Set((seguindo ?? []).map((f) => f.following_id as string));

    return (perfis ?? []).map((p) => ({
      id: p.id as string,
      apelido: (p.apelido as string) ?? "Usuário",
      avatar_url: p.avatar_url as string | null,
      ja_sigo: seguindoSet.has(p.id as string),
    }));
  } catch {
    return [];
  }
}
