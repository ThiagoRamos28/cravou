import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
}));

const fases = [
  { fase: "grupos", rodadas: ["1", "2", "3"] },
  { fase: "oitavas", rodadas: [] },
];

describe("JogosFiltro", () => {
  it("renderiza um chip por fase existente", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: /grupos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /oitavas/i })).toBeInTheDocument();
  });

  it("mostra as rodadas da fase ativa", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("marca a fase ativa com aria-current", () => {
    render(<JogosFiltro fases={fases} faseAtiva="grupos" rodadaAtiva="1" />);
    expect(screen.getByRole("button", { name: /grupos/i })).toHaveAttribute("aria-current", "true");
  });
});
