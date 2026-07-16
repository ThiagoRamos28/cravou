import { describe, it, expect } from "vitest";
import { competicoesVisiveis, resolverCompeticao, type Competicao } from "@/lib/competicoes";

const copa: Competicao = { id: "c1", slug: "copa-mundo-2026", nome: "Copa", formato: "fases", ativa: false, ordem: 1 };
const bra: Competicao = { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão", formato: "pontos-corridos", ativa: true, ordem: 2 };

describe("competicoesVisiveis", () => {
  it("inclui ativas e as com opt-in, ordenadas por ordem", () => {
    expect(competicoesVisiveis([copa, bra], ["copa-mundo-2026"])).toEqual([copa, bra]);
  });
  it("exclui inativa sem opt-in", () => {
    expect(competicoesVisiveis([copa, bra], [])).toEqual([bra]);
  });
});

describe("resolverCompeticao", () => {
  it("usa o cookie quando aponta para competição visível", () => {
    expect(resolverCompeticao([copa, bra], "copa-mundo-2026")).toEqual(copa);
  });
  it("cai na ativa de maior ordem quando sem cookie", () => {
    expect(resolverCompeticao([copa, bra], undefined)).toEqual(bra);
  });
  it("ignora cookie inválido", () => {
    expect(resolverCompeticao([copa, bra], "inexistente")).toEqual(bra);
  });
});
