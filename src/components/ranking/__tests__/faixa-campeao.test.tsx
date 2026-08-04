import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaixaCampeao } from "@/components/ranking/faixa-campeao";
import type { RankingRow } from "@/lib/ranking-shared";

function linha(apelido: string, extra: Partial<RankingRow> = {}): RankingRow {
  return {
    user_id: apelido, apelido, avatar_url: null,
    pontos: 0, cravadas: 0, acertos_saldo: 0, acertos_resultado: 0,
    acertos_gols: 0, erros: 0, palpites_pontuados: 0, total_palpites: 0,
    pontos_max_total: 0, ...extra,
  };
}

describe("FaixaCampeao", () => {
  it("anuncia o campeão de um mês fechado", () => {
    render(<FaixaCampeao rotulo="Julho" fechado linhas={[linha("Ana", { pontos: 87 })]} />);
    expect(screen.getByText("Campeão de Julho")).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/87 pts/)).toBeInTheDocument();
  });

  it("usa o plural e junta os nomes quando há co-campeões", () => {
    const base = { pontos: 87, cravadas: 3, acertos_saldo: 2, acertos_resultado: 5, acertos_gols: 4, erros: 1 };
    render(<FaixaCampeao rotulo="Julho" fechado linhas={[linha("Ana", base), linha("Zé", base)]} />);
    expect(screen.getByText("Campeões de Julho")).toBeInTheDocument();
    expect(screen.getByText(/Ana e Zé/)).toBeInTheDocument();
  });

  it("mostra a liderança de um mês em andamento", () => {
    render(<FaixaCampeao rotulo="Agosto" fechado={false} linhas={[linha("Ana", { pontos: 12 })]} />);
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
    expect(screen.getByText(/liderança de Ana/)).toBeInTheDocument();
    expect(screen.getByText(/12 pts/)).toBeInTheDocument();
  });

  it("diz que ninguém pontuou num mês em andamento sem pontos", () => {
    render(<FaixaCampeao rotulo="Agosto" fechado={false} linhas={[linha("Ana")]} />);
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
    expect(screen.getByText(/ninguém pontuou ainda/)).toBeInTheDocument();
  });

  it("não renderiza num mês fechado em que ninguém pontuou", () => {
    const { container } = render(<FaixaCampeao rotulo="Abril" fechado linhas={[linha("Ana")]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
