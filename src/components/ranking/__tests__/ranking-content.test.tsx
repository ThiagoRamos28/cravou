import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RankingContent } from "@/components/ranking/ranking-content";
import type { RankingRow } from "@/lib/ranking";
import { buscarRanking } from "@/app/ranking/actions";

vi.mock("@/app/ranking/actions", () => ({
  buscarRanking: vi.fn(),
}));

const linhasIniciais: RankingRow[] = [
  {
    user_id: "u1", apelido: "Abacatão", avatar_url: null,
    pontos: 15, cravadas: 1, acertos_saldo: 0, acertos_resultado: 1,
    acertos_gols: 0, erros: 2, palpites_pontuados: 4, total_palpites: 5,
    pontos_max_total: 40,
  },
];

const linhasTemporada2: RankingRow[] = [
  {
    user_id: "u2", apelido: "Dannilo", avatar_url: null,
    pontos: 20, cravadas: 0, acertos_saldo: 1, acertos_resultado: 2,
    acertos_gols: 0, erros: 1, palpites_pontuados: 4, total_palpites: 4,
    pontos_max_total: 40,
  },
];

describe("RankingContent", () => {
  beforeEach(() => {
    vi.mocked(buscarRanking).mockReset();
  });

  it("renderiza com linhasIniciais sem chamar a action", () => {
    render(<RankingContent linhasIniciais={linhasIniciais} meuId="u1" />);
    expect(screen.getAllByText("Abacatão").length).toBeGreaterThan(0);
    expect(buscarRanking).not.toHaveBeenCalled();
  });

  it("ao trocar para temporada_2, chama buscarRanking e renderiza as novas linhas", async () => {
    vi.mocked(buscarRanking).mockResolvedValue(linhasTemporada2);
    render(<RankingContent linhasIniciais={linhasIniciais} meuId="u1" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    expect(buscarRanking).toHaveBeenCalledWith("temporada_2");
    await waitFor(() => {
      expect(screen.getAllByText("Dannilo").length).toBeGreaterThan(0);
    });
  });

  it("mostra mensagem de estado vazio quando a resposta é vazia", async () => {
    vi.mocked(buscarRanking).mockResolvedValue([]);
    render(<RankingContent linhasIniciais={linhasIniciais} meuId="u1" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_1" } });
    await waitFor(() => {
      expect(
        screen.getByText("Nenhum palpite pontuado neste período ainda.")
      ).toBeInTheDocument();
    });
  });
});
