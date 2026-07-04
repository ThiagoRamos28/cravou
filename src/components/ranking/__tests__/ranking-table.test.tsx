import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RankingTable } from "@/components/ranking/ranking-table";
import type { RankingRow } from "@/lib/ranking";

const linhas: RankingRow[] = [
  {
    user_id: "u1", apelido: "Abacatão", avatar_url: null,
    pontos: 15, cravadas: 1, acertos_saldo: 0, acertos_resultado: 1,
    acertos_gols: 0, erros: 2, palpites_pontuados: 4, total_palpites: 5,
    pontos_max_total: 40,
  },
  {
    user_id: "u2", apelido: "Dannilo", avatar_url: null,
    pontos: 15, cravadas: 0, acertos_saldo: 1, acertos_resultado: 2,
    acertos_gols: 0, erros: 1, palpites_pontuados: 4, total_palpites: 4,
    pontos_max_total: 40,
  },
  {
    user_id: "u3", apelido: "Mandioca", avatar_url: null,
    pontos: 10, cravadas: 0, acertos_saldo: 0, acertos_resultado: 2,
    acertos_gols: 0, erros: 1, palpites_pontuados: 3, total_palpites: 3,
    pontos_max_total: 30,
  },
];

const linhaComMaxDiferente: RankingRow[] = [
  {
    user_id: "u4", apelido: "Bola", avatar_url: null,
    pontos: 20, cravadas: 1, acertos_saldo: 0, acertos_resultado: 1,
    acertos_gols: 0, erros: 1, palpites_pontuados: 2, total_palpites: 2,
    pontos_max_total: 25,
  },
];

describe("RankingTable", () => {
  it("renderiza uma linha por usuário com posição e pontos", () => {
    render(<RankingTable linhas={linhas} meuId="u3" />);
    const primeira = screen.getByText("Abacatão").closest("tr")!;
    const ultima = screen.getByText("Mandioca").closest("tr")!;
    // posição = primeira célula
    expect(within(primeira).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(within(ultima).getAllByRole("cell")[0]).toHaveTextContent("3");
    // pontos e aproveitamento estão nas duas últimas células
    const celulas = within(ultima).getAllByRole("cell");
    expect(celulas.at(-2)).toHaveTextContent("10");   // Pontos
    expect(celulas.at(-1)).toHaveTextContent("33%");  // Aprov.
  });

  it("destaca a linha do usuário logado", () => {
    render(<RankingTable linhas={linhas} meuId="u3" />);
    const minha = screen.getByText("Mandioca").closest("tr");
    expect(minha).toHaveAttribute("data-eu", "true");
  });

  it("estado vazio quando ninguém pontuou", () => {
    render(<RankingTable linhas={[]} meuId={null} />);
    expect(screen.getByText(/ainda não há/i)).toBeInTheDocument();
  });

  it("calcula aproveitamento usando pontos_max_total, não palpites_pontuados * 10", () => {
    render(<RankingTable linhas={linhaComMaxDiferente} meuId={null} />);
    const linha = screen.getByText("Bola").closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    expect(celulas.at(-1)).toHaveTextContent("80%"); // 20 / 25 = 80%, não 20/20=100%
  });
});
