import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MesSelector } from "@/components/ranking/mes-selector";
import type { MesRanking } from "@/lib/ranking-shared";

const meses: MesRanking[] = [
  { mes: "2026-08", jogos: 40, pendentes: 40, palpites: 0, fechado: false },
  { mes: "2026-07", jogos: 32, pendentes: 0, palpites: 160, fechado: true },
];

describe("MesSelector", () => {
  it("lista Ranking Geral e um item por mês, com o nome do mês", () => {
    render(<MesSelector meses={meses} periodo="2026-08" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.getByRole("option", { name: "Ranking Geral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agosto" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Julho" })).toBeInTheDocument();
  });

  it("acrescenta o ano em mês de outro ano", () => {
    const antigos: MesRanking[] = [
      { mes: "2025-12", jogos: 5, pendentes: 0, palpites: 3, fechado: true },
    ];
    render(<MesSelector meses={antigos} periodo="geral" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.getByRole("option", { name: "Dezembro/2025" })).toBeInTheDocument();
  });

  it("dispara onChange com o mês escolhido", () => {
    const onChange = vi.fn();
    render(<MesSelector meses={meses} periodo="geral" onChange={onChange} anoCorrente={2026} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-07" } });
    expect(onChange).toHaveBeenCalledWith("2026-07");
  });

  it("não renderiza nada quando não há mês", () => {
    const { container } = render(
      <MesSelector meses={[]} periodo="geral" onChange={() => {}} anoCorrente={2026} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não mostra o botão de info das temporadas da Copa", () => {
    render(<MesSelector meses={meses} periodo="geral" onChange={() => {}} anoCorrente={2026} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
