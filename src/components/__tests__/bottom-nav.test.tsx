import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));

const { BottomNav } = await import("@/components/bottom-nav");

describe("BottomNav", () => {
  it("renderiza as 4 abas com rotas corretas", () => {
    mockUsePathname.mockReturnValue("/jogos");
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /jogos/i })).toHaveAttribute("href", "/jogos");
    expect(screen.getByRole("link", { name: /ranking/i })).toHaveAttribute("href", "/ranking");
    expect(screen.getByRole("link", { name: /feed/i })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: /pessoas/i })).toHaveAttribute("href", "/pessoas");
  });

  it("marca a aba ativa com aria-current", () => {
    mockUsePathname.mockReturnValue("/ranking");
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /ranking/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /jogos/i })).not.toHaveAttribute("aria-current");
  });

  it("ativa a aba Feed em subrota /feed/palpites", () => {
    mockUsePathname.mockReturnValue("/feed/palpites");
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /feed/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
