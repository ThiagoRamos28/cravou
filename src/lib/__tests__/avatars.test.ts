import { describe, it, expect } from "vitest";
import { AVATAR_OPTIONS, avatarPadrao } from "@/lib/avatars";

describe("avatars", () => {
  it("oferece 6 opções de avatar com URLs http", () => {
    expect(AVATAR_OPTIONS).toHaveLength(6);
    for (const url of AVATAR_OPTIONS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it("avatarPadrao é determinístico para a mesma seed", () => {
    expect(avatarPadrao("ze")).toBe(avatarPadrao("ze"));
    expect(avatarPadrao("ze")).toMatch(/^https?:\/\//);
  });
});
