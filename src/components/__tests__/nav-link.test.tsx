import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));

const { NavLink } = await import("@/components/nav-link");
const { useRotaAtiva } = await import("@/lib/nav");
const { renderHook } = await import("@testing-library/react");

describe("useRotaAtiva", () => {
  it("ativa em rota exata", () => {
    mockUsePathname.mockReturnValue("/feed");
    const { result } = renderHook(() => useRotaAtiva("/feed"));
    expect(result.current).toBe(true);
  });

  it("ativa em subrota", () => {
    mockUsePathname.mockReturnValue("/feed/palpites");
    const { result } = renderHook(() => useRotaAtiva("/feed"));
    expect(result.current).toBe(true);
  });

  it("inativa em rota irmã", () => {
    mockUsePathname.mockReturnValue("/feedback");
    const { result } = renderHook(() => useRotaAtiva("/feed"));
    expect(result.current).toBe(false);
  });
});

describe("NavLink", () => {
  it("marca aria-current=page quando ativo", () => {
    mockUsePathname.mockReturnValue("/jogos");
    render(<NavLink href="/jogos">Jogos</NavLink>);
    expect(screen.getByRole("link", { name: "Jogos" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("não marca aria-current quando inativo", () => {
    mockUsePathname.mockReturnValue("/ranking");
    render(<NavLink href="/jogos">Jogos</NavLink>);
    expect(screen.getByRole("link", { name: "Jogos" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
