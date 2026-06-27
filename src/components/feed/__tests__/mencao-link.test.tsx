import { describe, it, expect } from "vitest";
import { parseMencoes } from "../mencao-link";

describe("parseMencoes", () => {
  const perfis = { Thiago: "uid-1", Ana: "uid-2" };

  it("retorna texto puro sem menções", () => {
    const result = parseMencoes("Vamos Brasil!", perfis);
    expect(result).toEqual([{ tipo: "texto", valor: "Vamos Brasil!" }]);
  });

  it("parseia @apelido conhecido como menção", () => {
    const result = parseMencoes("Ei @Thiago olha isso", perfis);
    expect(result).toEqual([
      { tipo: "texto", valor: "Ei " },
      { tipo: "mencao", valor: "@Thiago", userId: "uid-1" },
      { tipo: "texto", valor: " olha isso" },
    ]);
  });

  it("mantém @desconhecido como texto", () => {
    const result = parseMencoes("@Ninguem aqui", perfis);
    expect(result).toEqual([
      { tipo: "texto", valor: "@Ninguem" },
      { tipo: "texto", valor: " aqui" },
    ]);
  });

  it("parseia múltiplas menções", () => {
    const result = parseMencoes("@Thiago e @Ana", perfis);
    const mencoes = result.filter((p) => p.tipo === "mencao");
    expect(mencoes).toHaveLength(2);
  });
});
