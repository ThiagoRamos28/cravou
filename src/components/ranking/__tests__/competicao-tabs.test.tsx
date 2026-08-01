import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompeticaoTabs } from "@/components/ranking/competicao-tabs";
import type { Competicao } from "@/lib/competicoes-shared";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const copa: Competicao = { id: "c1", slug: "copa-mundo-2026", nome: "Copa do Mundo 2026", formato: "fases", ativa: false, ordem: 1 };
const bra: Competicao = { id: "c2", slug: "brasileirao-2026", nome: "Brasileirão Série A 2026", formato: "pontos-corridos", ativa: true, ordem: 2 };

describe("CompeticaoTabs", () => {
  beforeEach(() => {
    refresh.mockReset();
    document.cookie = "competicao=; path=/; max-age=0";
  });

  it("põe as ativas como aba e as inativas em Temporadas anteriores", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    expect(screen.getByRole("tab", { name: "Brasileirão Série A 2026" })).toBeInTheDocument();
    expect(screen.getByText("Temporadas anteriores")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Copa do Mundo 2026" })).toBeInTheDocument();
  });

  it("marca a selecionada com aria-selected", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    expect(screen.getByRole("tab", { name: "Brasileirão Série A 2026" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Copa do Mundo 2026" })).toHaveAttribute("aria-selected", "false");
  });

  it("ao clicar, grava o slug no cookie e dá refresh", () => {
    render(<CompeticaoTabs competicoes={[copa, bra]} selecionadaId="c2" />);
    fireEvent.click(screen.getByRole("tab", { name: "Copa do Mundo 2026" }));
    expect(document.cookie).toContain("competicao=copa-mundo-2026");
    expect(refresh).toHaveBeenCalled();
  });

  it("não renderiza nada com uma competição só", () => {
    const { container } = render(<CompeticaoTabs competicoes={[bra]} selecionadaId="c2" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sem nenhuma ativa, todas viram aba e não há seção de anteriores", () => {
    const outra: Competicao = { ...bra, ativa: false };
    render(<CompeticaoTabs competicoes={[copa, outra]} selecionadaId="c2" />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByText("Temporadas anteriores")).not.toBeInTheDocument();
  });
});
