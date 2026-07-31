import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpcData: { data: unknown } = { data: [] };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      const encadeia = () => q;
      q.select = encadeia;
      q.order = encadeia;
      q.eq = encadeia;
      q.in = encadeia;
      q.not = encadeia;
      q.then = (resolve: (v: unknown) => unknown) => resolve(mockRpcData);
      return q;
    },
  }),
}));

import { listarJogos } from "@/lib/matches";

const jogoBase = {
  fase: "grupos",
  rodada: "",
  time_casa: "Sao Paulo",
  time_fora: "Santos",
  bandeira_casa: null,
  bandeira_fora: null,
  placar_casa: null,
  placar_fora: null,
  odds: null,
};

describe("listarJogos — jogos não-jogáveis", () => {
  beforeEach(() => {
    mockRpcData.data = [
      { ...jogoBase, id: "1", status: "agendado", inicio_em: "2026-09-01T20:00:00Z" },
      { ...jogoBase, id: "2", status: "adiado", inicio_em: "2026-07-29T20:00:00Z" },
      { ...jogoBase, id: "3", status: "cancelado", inicio_em: "2026-07-29T20:00:00Z" },
      { ...jogoBase, id: "4", status: "finalizado", inicio_em: "2026-07-01T20:00:00Z" },
    ];
  });

  it("por padrão esconde adiado e cancelado", async () => {
    const jogos = await listarJogos();
    expect(jogos.map((j) => j.id)).toEqual(["1", "4"]);
  });

  it("esconde adiado mesmo quando o jogo tem palpite (some para todos)", async () => {
    const jogos = await listarJogos();
    expect(jogos.some((j) => j.status === "adiado")).toBe(false);
  });

  it("incluirNaoJogaveis devolve todos os estados (visão do admin)", async () => {
    const jogos = await listarJogos({ incluirNaoJogaveis: true });
    expect(jogos.map((j) => j.id)).toEqual(["1", "2", "3", "4"]);
  });
});
