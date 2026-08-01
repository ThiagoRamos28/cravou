import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match } from "@/lib/matches";

vi.mock("@/app/admin/actions", () => ({
  salvarPlacar: vi.fn(async () => ({})),
}));

import { MatchAdminRow } from "@/components/admin/match-admin-row";

function jogo(status: Match["status"]): Match {
  return {
    id: "m1",
    fase: "grupos",
    rodada: "",
    time_casa: "Sao Paulo",
    time_fora: "Santos",
    bandeira_casa: null,
    bandeira_fora: null,
    inicio_em: "2026-07-29T20:00:00Z",
    status,
    placar_casa: null,
    placar_fora: null,
    odds: null,
  };
}

describe("MatchAdminRow — selo de estado", () => {
  it("mostra o selo Adiado", () => {
    render(<MatchAdminRow match={jogo("adiado")} />);
    expect(screen.getByText("Adiado")).toBeInTheDocument();
  });

  it("mostra o selo Cancelado", () => {
    render(<MatchAdminRow match={jogo("cancelado")} />);
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("não mostra selo em jogo agendado", () => {
    render(<MatchAdminRow match={jogo("agendado")} />);
    expect(screen.queryByText("Adiado")).toBeNull();
    expect(screen.queryByText("Cancelado")).toBeNull();
  });
});
