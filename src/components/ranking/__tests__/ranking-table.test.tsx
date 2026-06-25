import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RankingTable } from "@/components/ranking/ranking-table";
import type { RankingRow } from "@/lib/ranking";

const linhas: RankingRow[] = [
  { user_id: "u1", apelido: "Abacatão", avatar_url: null, pontos: 15, cravadas: 1, palpites_pontuados: 4 },
  { user_id: "u2", apelido: "Dannilo", avatar_url: null, pontos: 15, cravadas: 0, palpites_pontuados: 4 },
  { user_id: "u3", apelido: "Mandioca", avatar_url: null, pontos: 10, cravadas: 0, palpites_pontuados: 3 },
];

describe("RankingTable", () => {
  it("renderiza uma linha por usuário com posição e pontos", () => {
    render(<RankingTable linhas={linhas} meuId="u3" />);
    const primeira = screen.getByText("Abacatão").closest("tr")!;
    const ultima = screen.getByText("Mandioca").closest("tr")!;
    // posição = primeira célula; pontos = última célula
    expect(within(primeira).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(within(ultima).getAllByRole("cell")[0]).toHaveTextContent("3");
    expect(within(ultima).getAllByRole("cell").at(-1)).toHaveTextContent("10");
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
});
