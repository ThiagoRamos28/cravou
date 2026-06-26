import { createAdminClient } from "@/lib/supabase/admin";

export type MotivoNivel = "exato" | "saldo" | "resultado" | "gols" | "erro";

export type PalpiteAuditado = {
  id: string;
  apelido: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  motivo: MotivoNivel;
  detalhe: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function motivoPalpite(
  palpiteCasa: number,
  palpiteFora: number,
  placarCasa: number,
  placarFora: number
): { motivo: MotivoNivel; detalhe: string } {
  const mesmoResultado =
    Math.sign(palpiteCasa - palpiteFora) === Math.sign(placarCasa - placarFora);

  if (palpiteCasa === placarCasa && palpiteFora === placarFora)
    return { motivo: "exato", detalhe: "Placar exato" };

  if (
    placarCasa !== placarFora &&
    mesmoResultado &&
    palpiteCasa - palpiteFora === placarCasa - placarFora
  )
    return { motivo: "saldo", detalhe: "Vencedor certo e diferença de gols exata" };

  if (palpiteCasa === placarCasa)
    return {
      motivo: "gols",
      detalhe: `Acertou os gols do time da casa (${placarCasa})`,
    };

  if (palpiteFora === placarFora)
    return {
      motivo: "gols",
      detalhe: `Acertou os gols do time de fora (${placarFora})`,
    };

  if (mesmoResultado)
    return { motivo: "resultado", detalhe: "Resultado (V/E/D) correto" };

  return { motivo: "erro", detalhe: "Errou resultado e placares" };
}

type RawPredRow = {
  id: string;
  user_id: string;
  palpite_casa: number;
  palpite_fora: number;
  pontos: number | null;
  matches: { placar_casa: number | null; placar_fora: number | null } | null;
};

export async function listarPalpitesJogo(
  matchId: string
): Promise<PalpiteAuditado[]> {
  if (!UUID_RE.test(matchId)) return [];
  try {
    const supabase = createAdminClient();

    const { data: preds } = await supabase
      .from("predictions")
      .select(
        "id, user_id, palpite_casa, palpite_fora, pontos, matches(placar_casa, placar_fora)"
      )
      .eq("match_id", matchId)
      .limit(200);

    if (!preds || preds.length === 0) return [];
    const rows = preds as unknown as RawPredRow[];

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, apelido")
      .in("id", userIds);

    const apelidoMap = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; apelido: string | null }) => [
        p.id,
        p.apelido ?? "Sem apelido",
      ])
    );

    return rows.map((row) => {
      const m = row.matches;
      const { motivo, detalhe } =
        m?.placar_casa != null && m?.placar_fora != null
          ? motivoPalpite(
              row.palpite_casa,
              row.palpite_fora,
              m.placar_casa,
              m.placar_fora
            )
          : { motivo: "erro" as MotivoNivel, detalhe: "Jogo sem placar definido" };

      return {
        id: row.id,
        apelido: apelidoMap.get(row.user_id) ?? "Sem apelido",
        palpite_casa: row.palpite_casa,
        palpite_fora: row.palpite_fora,
        pontos: row.pontos,
        motivo,
        detalhe,
      };
    });
  } catch {
    return [];
  }
}
