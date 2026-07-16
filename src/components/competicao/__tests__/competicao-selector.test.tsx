import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompeticaoSelector } from "../competicao-selector";
import type { Competicao } from "@/lib/competicoes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const comps: Competicao[] = [
  { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 },
  { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 },
];

describe("CompeticaoSelector", () => {
  it("lista as competições e marca a selecionada", () => {
    render(<CompeticaoSelector competicoes={comps} selecionadaId="c2" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("c2");
    expect(screen.getByRole("option", { name: "Copa do Mundo 2026" })).toBeInTheDocument();
  });

  it("não renderiza com uma só competição", () => {
    const { container } = render(<CompeticaoSelector competicoes={[comps[1]]} selecionadaId="c2" />);
    expect(container.firstChild).toBeNull();
  });
});
