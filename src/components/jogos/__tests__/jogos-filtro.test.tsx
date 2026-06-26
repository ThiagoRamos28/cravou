import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JogosFiltro } from "@/components/jogos/jogos-filtro";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/jogos",
}));

describe("JogosFiltro", () => {
  it("renderiza os botões 'Palpitar agora' e 'Encerrados'", () => {
    render(<JogosFiltro />);
    expect(screen.getByRole("button", { name: /abertos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /encerrados/i })).toBeInTheDocument();
  });

  it("marca 'Palpitar agora' como ativo quando soAbertos=true", () => {
    render(<JogosFiltro soAbertos />);
    expect(screen.getByRole("button", { name: /abertos/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("marca 'Encerrados' como ativo quando soEncerrados=true", () => {
    render(<JogosFiltro soEncerrados />);
    expect(screen.getByRole("button", { name: /encerrados/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("exibe badge de contagem quando há jogos abertos", () => {
    render(<JogosFiltro jogosAbertosCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("oculta o badge quando soAbertos está ativo", () => {
    render(<JogosFiltro soAbertos jogosAbertosCount={3} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("volta ao default (abertos) ao clicar em 'Abertos' quando inativo", async () => {
    render(<JogosFiltro />);
    await userEvent.click(screen.getByRole("button", { name: /abertos/i }));
    expect(push).toHaveBeenCalledWith("/jogos");
  });

  it("navega com soAbertos=0 ao clicar em 'Abertos' quando já está ativo", async () => {
    render(<JogosFiltro soAbertos />);
    await userEvent.click(screen.getByRole("button", { name: /abertos/i }));
    expect(push).toHaveBeenCalledWith("/jogos?soAbertos=0");
  });
});
