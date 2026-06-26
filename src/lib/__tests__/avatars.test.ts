import { describe, it, expect } from "vitest";
import {
  AVATAR_OPTIONS,
  ESTILOS_AVATAR,
  avatarPadrao,
  avatarUrlFromEstilo,
  estiloDoAvatar,
} from "@/lib/avatars";

describe("AVATAR_OPTIONS", () => {
  it("oferece 6 opções com URLs http (compat onboarding)", () => {
    expect(AVATAR_OPTIONS).toHaveLength(6);
    for (const url of AVATAR_OPTIONS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

describe("avatarPadrao", () => {
  it("é determinístico para a mesma seed", () => {
    expect(avatarPadrao("ze")).toBe(avatarPadrao("ze"));
    expect(avatarPadrao("ze")).toMatch(/^https?:\/\//);
  });
});

describe("ESTILOS_AVATAR", () => {
  it("contém exatamente 5 estilos", () => {
    expect(Object.keys(ESTILOS_AVATAR)).toHaveLength(5);
  });

  it("cada estilo tem 6 seeds", () => {
    for (const seeds of Object.values(ESTILOS_AVATAR)) {
      expect(seeds).toHaveLength(6);
    }
  });

  it("inclui fun-emoji, adventurer, bottts, pixel-art e lorelei", () => {
    expect(ESTILOS_AVATAR).toHaveProperty("fun-emoji");
    expect(ESTILOS_AVATAR).toHaveProperty("adventurer");
    expect(ESTILOS_AVATAR).toHaveProperty("bottts");
    expect(ESTILOS_AVATAR).toHaveProperty("pixel-art");
    expect(ESTILOS_AVATAR).toHaveProperty("lorelei");
  });
});

describe("avatarUrlFromEstilo", () => {
  it("gera URL DiceBear válida para estilo e seed", () => {
    const url = avatarUrlFromEstilo("fun-emoji", "gol");
    expect(url).toBe(
      "https://api.dicebear.com/9.x/fun-emoji/svg?seed=gol"
    );
  });

  it("codifica seeds com caracteres especiais", () => {
    const url = avatarUrlFromEstilo("lorelei", "repórter");
    expect(url).toContain("dicebear.com/9.x/lorelei/svg?seed=");
    expect(url).toContain(encodeURIComponent("repórter"));
  });
});

describe("estiloDoAvatar", () => {
  it("extrai o estilo de uma URL DiceBear 9.x válida", () => {
    const url = "https://api.dicebear.com/9.x/pixel-art/svg?seed=abc";
    expect(estiloDoAvatar(url)).toBe("pixel-art");
  });

  it("retorna fun-emoji para URL desconhecida", () => {
    expect(estiloDoAvatar("https://example.com/foto.png")).toBe("fun-emoji");
  });

  it("retorna fun-emoji para string vazia", () => {
    expect(estiloDoAvatar("")).toBe("fun-emoji");
  });

  it("retorna fun-emoji para estilo fora do mapa", () => {
    const url = "https://api.dicebear.com/9.x/estilo-desconhecido/svg?seed=x";
    expect(estiloDoAvatar(url)).toBe("fun-emoji");
  });
});
