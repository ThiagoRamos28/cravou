import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OddsJogo } from "../odds-jogo";
import type { Odds } from "@/lib/matches";

const odds: Odds = {
  casa: "2.32",
  empate: "3.10",
  fora: "3.00",
  over25: "1.95",
  under25: "1.85",
  ambas_sim: "1.80",
  ambas_nao: "1.95",
  bookmaker: "bet365",
  capturado_em: "2026-07-16T18:00:00.000Z",
};

describe("OddsJogo", () => {
  it("começa recolhido (valores não visíveis)", () => {
    render(<OddsJogo odds={odds} />);
    expect(screen.getByRole("button", { name: /ver odds/i })).toBeInTheDocument();
    expect(screen.queryByText("2.32")).not.toBeInTheDocument();
  });

  it("expande ao clicar e mostra os valores", async () => {
    const user = userEvent.setup();
    render(<OddsJogo odds={odds} />);
    await user.click(screen.getByRole("button", { name: /ver odds/i }));
    expect(screen.getByText("2.32")).toBeInTheDocument();
    expect(screen.queryAllByText("1.95").length).toBeGreaterThan(0);
    expect(screen.getByText("1.80")).toBeInTheDocument();
  });

  it("omite mercados ausentes (over/under e ambas null)", async () => {
    const user = userEvent.setup();
    const parcial: Odds = {
      ...odds,
      over25: null,
      under25: null,
      ambas_sim: null,
      ambas_nao: null,
    };
    render(<OddsJogo odds={parcial} />);
    await user.click(screen.getByRole("button", { name: /ver odds/i }));
    expect(screen.getByText("2.32")).toBeInTheDocument();
    expect(screen.queryByText(/over 2\.5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ambas marcam/i)).not.toBeInTheDocument();
  });
});
