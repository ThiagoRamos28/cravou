import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Competicao } from "@/lib/competicoes-shared";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { CompeticaoSelectorSlot } = await import(
  "@/components/competicao/competicao-selector-slot"
);

const comps: Competicao[] = [
  { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 },
  { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 },
];

describe("CompeticaoSelectorSlot", () => {
  it("não renderiza em /ranking, onde as abas fazem esse papel", () => {
    mockUsePathname.mockReturnValue("/ranking");
    const { container } = render(<CompeticaoSelectorSlot competicoes={comps} selecionadaId="c2" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza o seletor nas outras rotas", () => {
    mockUsePathname.mockReturnValue("/jogos");
    render(<CompeticaoSelectorSlot competicoes={comps} selecionadaId="c2" />);
    expect(screen.getByRole("combobox", { name: "Selecionar competição" })).toBeInTheDocument();
  });
});
