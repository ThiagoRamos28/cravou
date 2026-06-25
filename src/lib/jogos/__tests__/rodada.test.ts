import { describe, it, expect } from "vitest";
import { rodadaPorData } from "@/lib/jogos/rodada";

const blocos = [
  { rodada: "1", ate: "2026-06-17T00:00:00.000Z" },
  { rodada: "2", ate: "2026-06-23T00:00:00.000Z" },
  { rodada: "3", ate: "2026-06-28T00:00:00.000Z" },
];

describe("rodadaPorData", () => {
  it("classifica um jogo no primeiro bloco", () => {
    expect(rodadaPorData("2026-06-12T18:00:00.000Z", blocos)).toBe("1");
  });
  it("classifica um jogo no segundo bloco", () => {
    expect(rodadaPorData("2026-06-20T18:00:00.000Z", blocos)).toBe("2");
  });
  it("classifica um jogo no terceiro bloco", () => {
    expect(rodadaPorData("2026-06-27T18:00:00.000Z", blocos)).toBe("3");
  });
  it("retorna vazio quando depois de todos os blocos", () => {
    expect(rodadaPorData("2026-07-10T18:00:00.000Z", blocos)).toBe("");
  });
  it("fronteira: instante igual ao 'ate' cai no bloco seguinte", () => {
    expect(rodadaPorData("2026-06-17T00:00:00.000Z", blocos)).toBe("2");
  });
});
