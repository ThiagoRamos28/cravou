import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PalpiteAmigoCard } from "../palpite-amigo-card";
import type { PalpiteAmigo } from "@/lib/feed";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n/paises", () => ({
  traduzirPais: (nome: string) => nome,
}));

const base: PalpiteAmigo = {
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
  feito_em: new Date().toISOString(),
  autor: { id: "u1", apelido: "Thiago", avatar_url: null },
};

describe("PalpiteAmigoCard", () => {
  it("exibe o apelido do autor", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Thiago")).toBeTruthy();
  });

  it("exibe os times", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Brazil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
  });

  it("exibe o placar do palpite", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("2 × 1")).toBeTruthy();
  });

  it("exibe badge Aguardando para jogo agendado", () => {
    render(<PalpiteAmigoCard palpite={base} />);
    expect(screen.getByText("Aguardando")).toBeTruthy();
  });

  it("exibe badge Exato para placar exato", () => {
    render(
      <PalpiteAmigoCard
        palpite={{ ...base, status: "finalizado", placar_casa: 2, placar_fora: 1, pontos: 10 }}
      />
    );
    expect(screen.getByText(/exato/i)).toBeTruthy();
  });
});
