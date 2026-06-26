import { describe, it, expect } from "vitest";
import { formatarDescricaoLog } from "@/lib/auditoria/log";

describe("formatarDescricaoLog", () => {
  it("salvar_placar com nomes de time inclui jogo e placar", () => {
    const r = formatarDescricaoLog(
      "salvar_placar",
      "AdminJoão",
      { placar_casa: 2, placar_fora: 1 },
      { placar_casa: 3, placar_fora: 2, time_casa: "Turkey", time_fora: "USA" }
    );
    expect(r).toContain("Turkey");
    expect(r).toContain("USA");
    expect(r).toContain("2×1");
    expect(r).toContain("3×2");
    expect(r).toContain("AdminJoão");
  });

  it("salvar_placar sem nomes de time omite jogo", () => {
    const r = formatarDescricaoLog(
      "salvar_placar",
      null,
      { placar_casa: 0, placar_fora: 0 },
      { placar_casa: 1, placar_fora: 0 }
    );
    expect(r).toContain("0×0");
    expect(r).toContain("1×0");
  });

  it("sync_placar_auto inclui jogo e placar final", () => {
    const r = formatarDescricaoLog(
      "sync_placar_auto",
      null,
      { placar_casa: null, placar_fora: null },
      { placar_casa: 3, placar_fora: 2, time_casa: "Turkey", time_fora: "USA" }
    );
    expect(r).toMatch(/sync/i);
    expect(r).toContain("Turkey");
    expect(r).toContain("3×2");
  });

  it("disparar_sync menciona admin quando presente", () => {
    const r = formatarDescricaoLog("disparar_sync", "AdminJoão", null, null);
    expect(r).toContain("AdminJoão");
  });

  it("disparar_sync sem admin é genérico", () => {
    const r = formatarDescricaoLog("disparar_sync", null, null, null);
    expect(r).toMatch(/sync/i);
  });

  it("acao desconhecida retorna a própria acao", () => {
    const r = formatarDescricaoLog("acao_nova", null, null, null);
    expect(r).toBe("acao_nova");
  });
});
