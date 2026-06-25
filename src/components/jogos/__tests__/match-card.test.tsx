import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "@/components/jogos/match-card";
import type { Match } from "@/lib/matches";

// PalpiteForm agora usa useToast — mockar para evitar erro de contexto.
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const base: Match = {
  id: "1",
  fase: "grupos",
  rodada: "1",
  time_casa: "Brasil",
  time_fora: "Sérvia",
  bandeira_casa: null,
  bandeira_fora: null,
  inicio_em: "2026-06-20T19:00:00+00:00",
  status: "agendado",
  placar_casa: null,
  placar_fora: null,
};

describe("MatchCard", () => {
  it("mostra os dois times", () => {
    render(<MatchCard match={base} />);
    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText("Sérvia")).toBeInTheDocument();
  });

  it("mostra o placar quando finalizado", () => {
    render(
      <MatchCard match={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 0 }} />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("aplica truncate nos nomes dos times para evitar overflow", () => {
    render(
      <MatchCard
        match={{ ...base, time_casa: "A".repeat(30), time_fora: "B".repeat(30) }}
        minutosCorte={10}
      />
    );
    // Os spans de nome dos times devem ter a classe truncate
    const spans = screen
      .getAllByText(/A{30}|B{30}/)
      .filter((el) => el.tagName === "SPAN" && !el.className.includes("sr-only"));
    expect(spans.length).toBeGreaterThan(0);
    spans.forEach((el) => expect(el).toHaveClass("truncate"));
  });
});
