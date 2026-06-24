import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const getPerfilMock = vi.fn();
vi.mock("@/lib/auth/profile", () => ({ getPerfil: getPerfilMock }));

describe("requireAdmin", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getPerfilMock.mockReset();
  });

  it("redireciona para / se não for admin", async () => {
    getPerfilMock.mockResolvedValue({ id: "u1", apelido: "Zé", avatar_url: null, is_admin: false });
    const { requireAdmin } = await import("@/lib/auth/admin");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/");
  });

  it("retorna o perfil se for admin", async () => {
    const admin = { id: "u1", apelido: "Chefe", avatar_url: null, is_admin: true };
    getPerfilMock.mockResolvedValue(admin);
    const { requireAdmin } = await import("@/lib/auth/admin");
    await expect(requireAdmin()).resolves.toEqual(admin);
  });
});
