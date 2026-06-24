import { describe, it, expect } from "vitest";
import {
  credenciaisSchema,
  magicLinkSchema,
  perfilSchema,
  validar,
} from "@/lib/auth/validation";

describe("validar()", () => {
  it("aceita credenciais válidas", () => {
    const r = validar(credenciaisSchema, { email: "a@b.com", senha: "123456" });
    expect(r.sucesso).toBe(true);
  });

  it("rejeita email inválido com mensagem em PT-BR", () => {
    const r = validar(credenciaisSchema, { email: "nao-email", senha: "123456" });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/e-mail/i);
  });

  it("rejeita senha com menos de 6 caracteres", () => {
    const r = validar(credenciaisSchema, { email: "a@b.com", senha: "123" });
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/senha/i);
  });

  it("magicLinkSchema exige email válido", () => {
    expect(validar(magicLinkSchema, { email: "a@b.com" }).sucesso).toBe(true);
    expect(validar(magicLinkSchema, { email: "x" }).sucesso).toBe(false);
  });

  it("perfilSchema exige apelido entre 2 e 20 e avatar não vazio", () => {
    expect(
      validar(perfilSchema, { apelido: "Zé", avatar_url: "u" }).sucesso
    ).toBe(true);
    expect(
      validar(perfilSchema, { apelido: "Z", avatar_url: "u" }).sucesso
    ).toBe(false);
    expect(
      validar(perfilSchema, { apelido: "Zé", avatar_url: "" }).sucesso
    ).toBe(false);
  });
});
