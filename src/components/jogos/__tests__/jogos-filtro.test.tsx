import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
// A URL atual é lida por useSearchParams — é o que permite ao hook de navegação preservar
// parâmetros que o componente nem conhece. Cada teste ajusta `searchParamsAtual`.
let searchParamsAtual = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
  useSearchParams: () => new URLSearchParams(searchParamsAtual),
}));

import { JogosFiltro } from "@/components/jogos/jogos-filtro";

describe("JogosFiltro", () => {
  beforeEach(() => {
    push.mockReset();
    searchParamsAtual = "";
  });

  it("marca a situação atual", () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    expect(screen.getByRole("button", { name: /a fazer/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("oferece as três situações", () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    expect(screen.getByRole("button", { name: /a fazer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /encerrados/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /todos/i })).toBeInTheDocument();
  });

  it("clicar em Encerrados navega para a situação encerrados", async () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    await userEvent.click(screen.getByRole("button", { name: /encerrados/i }));
    expect(push).toHaveBeenCalledWith("/jogos?situacao=encerrados");
  });

  it("inverter a ordem preserva os outros filtros", async () => {
    searchParamsAtual = "situacao=encerrados&de=2026-07-01";
    render(<JogosFiltro situacao="encerrados" ordem="asc" de="2026-07-01" />);
    await userEvent.click(screen.getByRole("button", { name: /inverter ordem/i }));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("ordem=desc");
    expect(url).toContain("situacao=encerrados");
    expect(url).toContain("de=2026-07-01");
  });

  it("escolher data navega preservando a situação", async () => {
    searchParamsAtual = "situacao=encerrados";
    render(<JogosFiltro situacao="encerrados" ordem="asc" />);
    await userEvent.type(screen.getByLabelText("De"), "2026-07-15");
    const url = push.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("de=2026-07-15");
    expect(url).toContain("situacao=encerrados");
  });

  it("limpar remove as datas e mantém a situação", async () => {
    searchParamsAtual = "situacao=encerrados&de=2026-07-01&ate=2026-07-31";
    render(
      <JogosFiltro situacao="encerrados" ordem="asc" de="2026-07-01" ate="2026-07-31" />
    );
    await userEvent.click(screen.getByRole("button", { name: /limpar/i }));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("de=");
    expect(url).not.toContain("ate=");
    expect(url).toContain("situacao=encerrados");
  });

  it("não mostra Limpar quando não há data escolhida", () => {
    render(<JogosFiltro situacao="a_fazer" ordem="asc" />);
    expect(screen.queryByRole("button", { name: /limpar/i })).toBeNull();
  });
});
