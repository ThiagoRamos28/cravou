import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormaTimes } from "@/components/jogos/forma-times";
import type { FormaJogo } from "@/lib/matches";

function f(resultado: "V" | "E" | "D", adversario: string): FormaJogo {
  return {
    resultado,
    golsPro: resultado === "V" ? 2 : 1,
    golsContra: resultado === "V" ? 0 : resultado === "E" ? 1 : 3,
    adversario,
    mando: "casa",
    inicioEm: "2026-07-01T22:00:00.000Z",
  };
}

describe("FormaTimes", () => {
  it("mostra a letra V/E/D nos badges (não depende só de cor) e esconde o detalhe", () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "X"), f("E", "Y")]}
        formaFora={[f("D", "Z")]}
      />,
    );
    // letras presentes nos badges
    expect(screen.getAllByText("V").length).toBeGreaterThan(0);
    // detalhe (adversário) começa oculto
    expect(screen.queryByText(/X/)).toBeNull();
  });

  it("expande o detalhe ao clicar em 'ver forma'", async () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "Adversário1")]}
        formaFora={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /ver forma/i }));
    expect(screen.getByText(/Adversário1/)).toBeInTheDocument();
  });

  it("omite a linha de um time sem jogos", () => {
    render(
      <FormaTimes
        nomeCasa="Botafogo"
        nomeFora="Santos"
        formaCasa={[f("V", "X")]}
        formaFora={[]}
      />,
    );
    // Botafogo aparece (tem forma); nome do time sem forma não vira linha de badges.
    expect(screen.getByText("Botafogo")).toBeInTheDocument();
    expect(screen.queryByText("Santos")).toBeNull();
  });
});
