import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuditoriaPalpites } from "@/components/admin/auditoria-palpites";
import type { PalpiteAuditado } from "@/lib/auditoria/palpites";

const palpites: PalpiteAuditado[] = [
  {
    id: "p1",
    apelido: "Dannilo",
    palpite_casa: 0,
    palpite_fora: 3,
    pontos: 0,
    motivo: "erro",
    detalhe: "Errou resultado e placares",
  },
  {
    id: "p2",
    apelido: "Mandioca",
    palpite_casa: 1,
    palpite_fora: 2,
    pontos: 2,
    motivo: "gols",
    detalhe: "Acertou os gols do time de fora (2)",
  },
];

describe("AuditoriaPalpites", () => {
  it("renderiza o apelido e o palpite de cada usuário", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    expect(screen.getByText("Dannilo")).toBeInTheDocument();
    expect(screen.getByText("Mandioca")).toBeInTheDocument();
    expect(screen.getAllByText(/0 × 3/)).toHaveLength(1);
    expect(screen.getAllByText(/1 × 2/)).toHaveLength(1);
  });

  it("ícone de motivo tem o atributo title com o detalhe", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    const iconeErro = screen.getByTitle("Errou resultado e placares");
    expect(iconeErro).toBeInTheDocument();
    const iconeGols = screen.getByTitle("Acertou os gols do time de fora (2)");
    expect(iconeGols).toBeInTheDocument();
  });

  it("badge de pontos > 0 tem classe text-primary", () => {
    render(<AuditoriaPalpites palpites={palpites} />);
    // Mandioca tem 2 pontos
    const badges = screen.getAllByText(/^\d+$/);
    const badge2 = badges.find((el) => el.textContent === "2");
    expect(badge2?.className).toMatch(/text-primary/);
  });

  it("estado vazio exibe mensagem de seleção", () => {
    render(<AuditoriaPalpites palpites={[]} />);
    expect(screen.getByText(/selecione um jogo/i)).toBeInTheDocument();
  });
});
