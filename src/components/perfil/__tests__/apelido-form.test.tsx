import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApelidoForm } from "@/components/perfil/apelido-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarApelido: vi.fn(),
}));

describe("ApelidoForm", () => {
  it("renderiza o campo de apelido pré-preenchido", () => {
    render(<ApelidoForm apelidoAtual="Zezão" />);
    const input = screen.getByLabelText(/apelido/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Zezão");
  });

  it("renderiza o botão de salvar", () => {
    render(<ApelidoForm apelidoAtual="Zezão" />);
    expect(
      screen.getByRole("button", { name: /salvar apelido/i })
    ).toBeInTheDocument();
  });
});
