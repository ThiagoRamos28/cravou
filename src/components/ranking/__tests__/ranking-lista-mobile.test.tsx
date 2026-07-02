import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RankingListaMobile } from "@/components/ranking/ranking-lista-mobile";
import type { RankingRow } from "@/lib/ranking";

const linhas: RankingRow[] = [
  {
    user_id: "u1",
    apelido: "Thiago",
    avatar_url: null,
    pontos: 87,
    cravadas: 5,
    acertos_saldo: 4,
    acertos_resultado: 3,
    acertos_gols: 2,
    erros: 8,
    palpites_pontuados: 22,
    total_palpites: 24,
  },
  {
    user_id: "u2",
    apelido: "Maria",
    avatar_url: null,
    pontos: 81,
    cravadas: 4,
    acertos_saldo: 5,
    acertos_resultado: 2,
    acertos_gols: 1,
    erros: 9,
    palpites_pontuados: 21,
    total_palpites: 24,
  },
];

describe("RankingListaMobile", () => {
  it("mostra posição, apelido e pontos; detalhe fechado por padrão", () => {
    render(<RankingListaMobile linhas={linhas} meuId={null} />);
    expect(screen.getByText("Thiago")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.queryByText(/aproveitamento/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /thiago/i })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("expande ao tocar mostrando contadores e aproveitamento", () => {
    render(<RankingListaMobile linhas={linhas} meuId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /thiago/i }));
    expect(
      screen.getByRole("button", { name: /thiago/i })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/aproveitamento: 40%/i)).toBeInTheDocument();
  });

  it("permite duas linhas expandidas ao mesmo tempo", () => {
    render(<RankingListaMobile linhas={linhas} meuId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /thiago/i }));
    fireEvent.click(screen.getByRole("button", { name: /maria/i }));
    expect(screen.getAllByText(/aproveitamento/i)).toHaveLength(2);
  });

  it("destaca a linha do próprio usuário com badge você", () => {
    render(<RankingListaMobile linhas={linhas} meuId="u2" />);
    expect(screen.getByText("você")).toBeInTheDocument();
  });
});
