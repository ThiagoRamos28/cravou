import { describe, it, expect } from "vitest";
import { palpiteAberto } from "@/lib/palpites/corte";

const inicio = "2026-07-01T18:00:00.000Z"; // kickoff
const corte = 10; // minutos

describe("palpiteAberto", () => {
  it("aberto bem antes do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:00:00.000Z"))).toBe(true);
  });

  it("fechado depois do corte (mas antes do apito)", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:55:00.000Z"))).toBe(false);
  });

  it("fechado exatamente no instante do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:50:00.000Z"))).toBe(false);
  });

  it("aberto um segundo antes do corte", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T17:49:59.000Z"))).toBe(true);
  });

  it("fechado depois do apito", () => {
    expect(palpiteAberto(inicio, corte, new Date("2026-07-01T19:00:00.000Z"))).toBe(false);
  });
});
