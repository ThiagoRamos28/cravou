import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SenhaForm } from "@/components/perfil/senha-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarSenha: vi.fn(),
}));

describe("SenhaForm", () => {
  it("renderiza os três campos de senha", () => {
    render(<SenhaForm />);
    expect(screen.getByLabelText(/^senha atual$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nova senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirmar nova senha$/i)).toBeInTheDocument();
  });

  it("os campos são do tipo password", () => {
    render(<SenhaForm />);
    const inputs = screen.getAllByDisplayValue("");
    for (const input of inputs) {
      expect(input).toHaveAttribute("type", "password");
    }
  });

  it("renderiza o botão de salvar", () => {
    render(<SenhaForm />);
    expect(
      screen.getByRole("button", { name: /salvar nova senha/i })
    ).toBeInTheDocument();
  });
});
