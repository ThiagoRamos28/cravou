import { describe, it, expect } from "vitest";
import { motivoPalpite } from "@/lib/auditoria/palpites";

describe("motivoPalpite", () => {
  it("placar exato → motivo exato", () => {
    const r = motivoPalpite(3, 2, 3, 2);
    expect(r.motivo).toBe("exato");
    expect(r.detalhe).toBe("Placar exato");
  });

  it("vencedor certo + diferença exata → saldo", () => {
    const r = motivoPalpite(2, 0, 3, 1); // casa vence por 2
    expect(r.motivo).toBe("saldo");
    expect(r.detalhe).toMatch(/diferença/i);
  });

  it("vencedor certo mas diferença errada → resultado", () => {
    const r = motivoPalpite(1, 0, 3, 1);
    expect(r.motivo).toBe("resultado");
  });

  it("empate não-exato → resultado", () => {
    const r = motivoPalpite(1, 1, 2, 2);
    expect(r.motivo).toBe("resultado");
  });

  it("errou resultado, acertou gols da casa → gols (detalhe menciona casa)", () => {
    // Palpite: fora vence 4×3. Resultado: casa vence 2×3. Errou quem venceu, mas acertou gols da casa (3).
    const r = motivoPalpite(3, 4, 3, 2);
    expect(r.motivo).toBe("gols");
    expect(r.detalhe).toMatch(/casa/i);
    expect(r.detalhe).toContain("3");
  });

  it("acertou resultado (casa vence) E gols da casa mas não o placar exato → resultado, não gols", () => {
    // mesmoResultado=true tem prioridade sobre acertar os gols de um time
    const r = motivoPalpite(3, 1, 3, 2);
    expect(r.motivo).toBe("resultado");
  });

  it("errou resultado, acertou gols do fora → gols (detalhe menciona fora)", () => {
    const r = motivoPalpite(0, 3, 3, 3); // errou resultado (empate≠vitória), acertou gols do fora
    // sign(0-3)=-1, sign(3-3)=0 → mesmoResultado=false; placarFora(3)=palpiteFora(3) → gols
    expect(r.motivo).toBe("gols");
    expect(r.detalhe).toMatch(/fora/i);
    expect(r.detalhe).toContain("3");
  });

  it("errou tudo → erro", () => {
    const r = motivoPalpite(0, 3, 3, 2);
    expect(r.motivo).toBe("erro");
  });
});
