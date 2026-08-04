import { describe, it, expect } from "vitest";
import { diaSeguinte, limitesDeData, statusPorSituacao } from "@/lib/jogos/filtros";

describe("diaSeguinte", () => {
  it("avança um dia comum", () => {
    expect(diaSeguinte("2026-07-15")).toBe("2026-07-16");
  });

  it("vira o mês", () => {
    expect(diaSeguinte("2026-07-31")).toBe("2026-08-01");
  });

  it("vira o ano", () => {
    expect(diaSeguinte("2026-12-31")).toBe("2027-01-01");
  });

  it("acerta fevereiro em ano bissexto", () => {
    expect(diaSeguinte("2028-02-28")).toBe("2028-02-29");
  });

  it("acerta fevereiro em ano comum", () => {
    expect(diaSeguinte("2026-02-28")).toBe("2026-03-01");
  });
});

describe("limitesDeData", () => {
  it("sem datas, não impõe limite", () => {
    expect(limitesDeData()).toEqual({});
  });

  it("só `de` vira limite inferior em BRT", () => {
    expect(limitesDeData("2026-07-15")).toEqual({
      gte: "2026-07-15T00:00:00-03:00",
    });
  });

  it("só `ate` vira limite superior exclusivo no dia seguinte", () => {
    expect(limitesDeData(undefined, "2026-07-15")).toEqual({
      lt: "2026-07-16T00:00:00-03:00",
    });
  });

  it("intervalo fechado cobre os dois dias inteiros", () => {
    expect(limitesDeData("2026-07-15", "2026-07-31")).toEqual({
      gte: "2026-07-15T00:00:00-03:00",
      lt: "2026-08-01T00:00:00-03:00",
    });
  });

  it("um único dia cobre as 24h daquele dia em BRT", () => {
    const { gte, lt } = limitesDeData("2026-07-31", "2026-07-31");
    // Um jogo às 21h BRT de 31/07 é 2026-08-01T00:00:00Z — tem que cair dentro.
    const jogo21hBRT = new Date("2026-08-01T00:00:00Z").getTime();
    expect(new Date(gte!).getTime()).toBeLessThanOrEqual(jogo21hBRT);
    expect(new Date(lt!).getTime()).toBeGreaterThan(jogo21hBRT);
  });
});

describe("statusPorSituacao", () => {
  it("a_fazer = ainda não terminou (fecha o buraco dos 10 min)", () => {
    expect(statusPorSituacao("a_fazer", false)).toEqual(["agendado", "ao_vivo"]);
  });

  it("encerrados = só finalizado", () => {
    expect(statusPorSituacao("encerrados", false)).toEqual(["finalizado"]);
  });

  it("todos exclui adiado e cancelado", () => {
    expect(statusPorSituacao("todos", false)).toEqual([
      "agendado",
      "ao_vivo",
      "finalizado",
    ]);
  });

  it("incluirNaoJogaveis remove a restrição de status (visão do admin)", () => {
    expect(statusPorSituacao("todos", true)).toBeNull();
  });

  it("incluirNaoJogaveis não afeta um recorte explícito de situação", () => {
    expect(statusPorSituacao("encerrados", true)).toEqual(["finalizado"]);
  });
});
