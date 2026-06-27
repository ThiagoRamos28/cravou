import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteCardCompacto } from "../palpite-card-compacto";
import type { PalpiteResumido } from "@/lib/feed";

const base: PalpiteResumido = {
  jogo_id: "j1",
  time_casa: "Brazil",
  time_fora: "Argentina",
  bandeira_casa: null,
  bandeira_fora: null,
  palpite_casa: 2,
  palpite_fora: 1,
  placar_casa: null,
  placar_fora: null,
  status: "agendado",
  pontos: null,
};

describe("PalpiteCardCompacto", () => {
  it("exibe badge Aguardando para jogo não encerrado", () => {
    render(<PalpiteCardCompacto palpite={base} />);
    expect(screen.getByText("Aguardando")).toBeTruthy();
  });

  it("exibe badge Exato para placar exato", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/exato/i)).toBeTruthy();
    expect(screen.getByText(/\+10/)).toBeTruthy();
  });

  it("exibe badge Resultado para resultado correto, placar errado", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 3, placar_fora: 0, pontos: 5 }}
      />
    );
    expect(screen.getByText(/resultado/i)).toBeTruthy();
  });

  it("exibe badge Erro para palpite errado", () => {
    render(
      <PalpiteCardCompacto
        palpite={{ ...base, status: "finalizado", placar_casa: 0, placar_fora: 2, pontos: 0 }}
      />
    );
    expect(screen.getByText(/erro/i)).toBeTruthy();
  });
});
