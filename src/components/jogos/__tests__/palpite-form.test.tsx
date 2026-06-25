import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteForm } from "@/components/jogos/palpite-form";
import type { Match } from "@/lib/matches";

vi.mock("@/app/jogos/actions", () => ({ salvarPalpite: vi.fn() }));

const base: Match = {
  id: "m1",
  fase: "grupos",
  rodada: "1",
  time_casa: "Brasil",
  time_fora: "Argentina",
  bandeira_casa: null,
  bandeira_fora: null,
  inicio_em: "2026-07-01T18:00:00.000Z",
  status: "agendado",
  placar_casa: null,
  placar_fora: null,
};

describe("PalpiteForm", () => {
  it("mostra inputs habilitados quando o corte está aberto", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={futuro} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("desabilita e avisa quando o corte passou", () => {
    const passado: Match = { ...base, inicio_em: "2000-01-01T00:00:00.000Z" };
    render(<PalpiteForm match={passado} minutosCorte={10} />);
    expect(screen.getByLabelText(/palpite brasil/i)).toBeDisabled();
    expect(screen.getByText(/encerrad/i)).toBeInTheDocument();
  });

  it("preenche os valores do palpite existente", () => {
    const futuro: Match = { ...base, inicio_em: "2999-01-01T00:00:00.000Z" };
    render(
      <PalpiteForm
        match={futuro}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 1, pontos: null }}
      />
    );
    expect((screen.getByLabelText(/palpite brasil/i) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/palpite argentina/i) as HTMLInputElement).value).toBe("1");
  });

  it("mostra os pontos ganhos num jogo finalizado", () => {
    const finalizado: Match = {
      ...base,
      status: "finalizado",
      inicio_em: "2000-01-01T00:00:00.000Z",
      placar_casa: 3,
      placar_fora: 1,
    };
    render(
      <PalpiteForm
        match={finalizado}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 0, pontos: 7 }}
      />
    );
    expect(screen.getByText(/\+7 pts/i)).toBeInTheDocument();
  });

  it("destaca 'Cravou!' quando o palpite bateu o placar exato", () => {
    const finalizado: Match = {
      ...base,
      status: "finalizado",
      inicio_em: "2000-01-01T00:00:00.000Z",
      placar_casa: 2,
      placar_fora: 1,
    };
    render(
      <PalpiteForm
        match={finalizado}
        minutosCorte={10}
        palpite={{ id: "p1", match_id: "m1", palpite_casa: 2, palpite_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/cravou/i)).toBeInTheDocument();
    expect(screen.getByText(/\+10 pts/i)).toBeInTheDocument();
  });
});
