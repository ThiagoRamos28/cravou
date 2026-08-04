import { describe, it, expect } from "vitest";
import {
  normalizarPeriodo,
  ehPeriodoMensal,
  mesCorrenteBRT,
  mesesVisiveis,
  rotuloMes,
  campeaoDoMes,
  CRITERIOS_DESEMPATE,
  type MesRanking,
  type RankingRow,
} from "@/lib/ranking-shared";

function mes(m: string, extra: Partial<MesRanking> = {}): MesRanking {
  return { mes: m, jogos: 10, pendentes: 0, palpites: 0, fechado: true, ...extra };
}

function linha(apelido: string, extra: Partial<RankingRow> = {}): RankingRow {
  return {
    user_id: apelido, apelido, avatar_url: null,
    pontos: 0, cravadas: 0, acertos_saldo: 0, acertos_resultado: 0,
    acertos_gols: 0, erros: 0, palpites_pontuados: 0, total_palpites: 0,
    pontos_max_total: 0, ...extra,
  };
}

describe("ehPeriodoMensal", () => {
  it("aceita YYYY-MM válido", () => {
    expect(ehPeriodoMensal("2026-08")).toBe(true);
    expect(ehPeriodoMensal("2026-01")).toBe(true);
    expect(ehPeriodoMensal("2026-12")).toBe(true);
  });
  it("rejeita mês fora de 01..12 e formatos errados", () => {
    expect(ehPeriodoMensal("2026-00")).toBe(false);
    expect(ehPeriodoMensal("2026-13")).toBe(false);
    expect(ehPeriodoMensal("2026-8")).toBe(false);
    expect(ehPeriodoMensal("geral")).toBe(false);
    expect(ehPeriodoMensal("2026-08-01")).toBe(false);
  });
});

describe("normalizarPeriodo", () => {
  it("mantém os períodos fixos", () => {
    expect(normalizarPeriodo("geral")).toBe("geral");
    expect(normalizarPeriodo("temporada_1")).toBe("temporada_1");
    expect(normalizarPeriodo("temporada_2")).toBe("temporada_2");
  });
  it("mantém um mês válido", () => {
    expect(normalizarPeriodo("2026-08")).toBe("2026-08");
  });
  it("cai em geral para qualquer outra coisa", () => {
    expect(normalizarPeriodo("temporada_9")).toBe("geral");
    expect(normalizarPeriodo("2026-13")).toBe("geral");
    expect(normalizarPeriodo("")).toBe("geral");
  });
});

describe("mesCorrenteBRT", () => {
  it("usa o fuso de Brasília, não o do servidor", () => {
    // 2026-08-01T02:00:00Z ainda é 31/07 às 23h em Brasília (UTC−3).
    expect(mesCorrenteBRT(new Date("2026-08-01T02:00:00Z"))).toBe("2026-07");
  });
  it("vira o mês depois das 03:00 UTC", () => {
    expect(mesCorrenteBRT(new Date("2026-08-01T03:30:00Z"))).toBe("2026-08");
  });
});

describe("mesesVisiveis", () => {
  it("descarta mês com jogo e zero palpite", () => {
    const r = mesesVisiveis([mes("2026-04"), mes("2026-07", { palpites: 160 })], "2026-08");
    expect(r.map((m) => m.mes)).toEqual(["2026-07"]);
  });
  it("mantém o mês corrente mesmo sem palpite", () => {
    const r = mesesVisiveis([mes("2026-07", { palpites: 160 }), mes("2026-08")], "2026-08");
    expect(r.map((m) => m.mes)).toEqual(["2026-08", "2026-07"]);
  });
  it("ordena do mais recente para o mais antigo e não preenche buracos", () => {
    const entrada = [
      mes("2026-05", { palpites: 3 }),
      mes("2026-07", { palpites: 160 }),
      mes("2026-03", { palpites: 1 }),
    ];
    expect(mesesVisiveis(entrada, "2026-08").map((m) => m.mes)).toEqual([
      "2026-07", "2026-05", "2026-03",
    ]);
  });
  it("não inventa um mês corrente que não veio do banco", () => {
    expect(mesesVisiveis([mes("2026-07", { palpites: 1 })], "2026-06").map((m) => m.mes))
      .toEqual(["2026-07"]);
  });
});

describe("rotuloMes", () => {
  it("mostra só o nome dentro do ano corrente", () => {
    expect(rotuloMes("2026-08", 2026)).toBe("Agosto");
    expect(rotuloMes("2026-03", 2026)).toBe("Março");
  });
  it("acrescenta o ano fora dele", () => {
    expect(rotuloMes("2025-12", 2026)).toBe("Dezembro/2025");
  });
});

describe("campeaoDoMes", () => {
  it("devolve null para lista vazia", () => {
    expect(campeaoDoMes([])).toBeNull();
  });
  it("devolve null quando o topo tem zero pontos", () => {
    expect(campeaoDoMes([linha("Zé"), linha("Ana")])).toBeNull();
  });
  it("devolve o líder isolado", () => {
    const r = campeaoDoMes([linha("Ana", { pontos: 87 }), linha("Zé", { pontos: 40 })]);
    expect(r).toEqual({ nomes: ["Ana"], pontos: 87 });
  });
  it("desempata por cravadas", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3 }),
      linha("Zé", { pontos: 87, cravadas: 2 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de saldo", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3, acertos_saldo: 2 }),
      linha("Zé", { pontos: 87, cravadas: 3, acertos_saldo: 1 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de resultado", () => {
    const r = campeaoDoMes([
      linha("Ana", { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5 }),
      linha("Zé", { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 4 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por acertos de gols", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5 };
    const r = campeaoDoMes([
      linha("Ana", { ...base, acertos_gols: 4 }),
      linha("Zé", { ...base, acertos_gols: 3 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("desempata por menos erros", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5, acertos_gols: 4 };
    const r = campeaoDoMes([
      linha("Ana", { ...base, erros: 1 }),
      linha("Zé", { ...base, erros: 5 }),
    ]);
    expect(r?.nomes).toEqual(["Ana"]);
  });
  it("devolve co-campeões quando empatam nos seis critérios", () => {
    const base = {
      pontos: 87, cravadas: 3, acertos_saldo: 2,
      acertos_resultado: 5, acertos_gols: 4, erros: 1,
    };
    const r = campeaoDoMes([linha("Ana", base), linha("Zé", base), linha("Bia", { pontos: 40 })]);
    expect(r).toEqual({ nomes: ["Ana", "Zé"], pontos: 87 });
  });
  it("usa 'Sem apelido' quando o apelido é nulo", () => {
    const r = campeaoDoMes([linha("x", { apelido: null, pontos: 10 })]);
    expect(r?.nomes).toEqual(["Sem apelido"]);
  });
});

describe("CRITERIOS_DESEMPATE", () => {
  it("tem os seis critérios de mérito, na ordem do order by", () => {
    expect(CRITERIOS_DESEMPATE).toHaveLength(6);
    expect(CRITERIOS_DESEMPATE[0]).toMatch(/pontos/i);
    expect(CRITERIOS_DESEMPATE[5]).toMatch(/erros/i);
  });
});
