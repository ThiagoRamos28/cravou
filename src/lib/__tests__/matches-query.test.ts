import { describe, it, expect, vi, beforeEach } from "vitest";

const chamadas: Array<[string, unknown[]]> = [];
const resposta: { data: unknown[] | null; count: number } = { data: [], count: 0 };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      chamadas.push(["from", [tabela]]);
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "eq", "in", "gte", "lt", "gt", "range"]) {
        q[m] = (...args: unknown[]) => {
          chamadas.push([m, args]);
          return q;
        };
      }
      q.then = (resolve: (v: unknown) => unknown) => resolve(resposta);
      return q;
    },
  }),
}));

import { listarJogos } from "@/lib/matches";

function chamada(metodo: string) {
  return chamadas.filter(([m]) => m === metodo).map(([, args]) => args);
}

describe("listarJogos — filtros viram query", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta.data = [];
    resposta.count = 0;
  });

  it("por padrão pede só jogos que ainda não terminaram", async () => {
    await listarJogos({ competicaoId: "c1" });
    expect(chamada("in")).toContainEqual(["status", ["agendado", "ao_vivo"]]);
  });

  it("filtra a competição na query", async () => {
    await listarJogos({ competicaoId: "c1" });
    expect(chamada("eq")).toContainEqual(["competicao_id", "c1"]);
  });

  it("situacao encerrados vira eq de status", async () => {
    await listarJogos({ competicaoId: "c1", situacao: "encerrados" });
    expect(chamada("eq")).toContainEqual(["status", "finalizado"]);
  });

  it("situacao todos esconde adiado e cancelado", async () => {
    await listarJogos({ competicaoId: "c1", situacao: "todos" });
    expect(chamada("in")).toContainEqual([
      "status",
      ["agendado", "ao_vivo", "finalizado"],
    ]);
  });

  it("incluirNaoJogaveis não restringe status (admin vê adiado e cancelado)", async () => {
    await listarJogos({
      competicaoId: "c1",
      situacao: "todos",
      incluirNaoJogaveis: true,
    });
    const statusEmIn = chamada("in").filter(([col]) => col === "status");
    const statusEmEq = chamada("eq").filter(([col]) => col === "status");
    expect(statusEmIn).toHaveLength(0);
    expect(statusEmEq).toHaveLength(0);
  });

  it("intervalo de datas vira gte/lt com offset de Brasília", async () => {
    await listarJogos({ competicaoId: "c1", de: "2026-07-15", ate: "2026-07-31" });
    expect(chamada("gte")).toContainEqual(["inicio_em", "2026-07-15T00:00:00-03:00"]);
    expect(chamada("lt")).toContainEqual(["inicio_em", "2026-08-01T00:00:00-03:00"]);
  });

  it("apenasFuturos vira gt em inicio_em", async () => {
    await listarJogos({ competicaoId: "c1", apenasFuturos: true });
    const gt = chamada("gt");
    expect(gt).toHaveLength(1);
    expect(gt[0][0]).toBe("inicio_em");
  });

  it("ordem desc inverte a ordenação", async () => {
    await listarJogos({ competicaoId: "c1", ordem: "desc" });
    expect(chamada("order")).toContainEqual(["inicio_em", { ascending: false }]);
  });

  it("pagina no servidor com range", async () => {
    await listarJogos({ competicaoId: "c1", offset: 40, limite: 20 });
    expect(chamada("range")).toContainEqual([40, 59]);
  });

  it("devolve o total vindo do count", async () => {
    resposta.count = 261;
    const { total } = await listarJogos({ competicaoId: "c1" });
    expect(total).toBe(261);
  });

  it("falha aberta: devolve vazio e total 0 quando não vem data", async () => {
    resposta.data = null;
    const r = await listarJogos({ competicaoId: "c1" });
    expect(r.jogos).toEqual([]);
    expect(r.total).toBe(0);
  });
});
