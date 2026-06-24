import { describe, it, expect } from "vitest";
import { palpiteSchema } from "@/lib/palpites/validation";
import { validar } from "@/lib/auth/validation";

describe("palpiteSchema", () => {
  it("aceita placar válido", () => {
    const r = validar(palpiteSchema, { palpite_casa: 2, palpite_fora: 1 });
    expect(r.sucesso).toBe(true);
  });

  it("aceita strings numéricas (vindas de FormData)", () => {
    const r = validar(palpiteSchema, { palpite_casa: "0", palpite_fora: "3" });
    expect(r).toEqual({ sucesso: true, dados: { palpite_casa: 0, palpite_fora: 3 } });
  });

  it("rejeita números negativos", () => {
    const r = validar(palpiteSchema, { palpite_casa: -1, palpite_fora: 0 });
    expect(r.sucesso).toBe(false);
  });

  it("rejeita valor não numérico", () => {
    const r = validar(palpiteSchema, { palpite_casa: "abc", palpite_fora: 1 });
    expect(r.sucesso).toBe(false);
  });

  it("rejeita campo ausente", () => {
    const r = validar(palpiteSchema, { palpite_casa: 1 });
    expect(r.sucesso).toBe(false);
  });
});
