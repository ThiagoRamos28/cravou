import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarForm } from "@/components/perfil/avatar-form";

vi.mock("@/app/perfil/actions", () => ({
  atualizarAvatar: vi.fn(),
}));

const avatarFunEmoji = "https://api.dicebear.com/9.x/fun-emoji/svg?seed=gol";
const avatarPixelArt = "https://api.dicebear.com/9.x/pixel-art/svg?seed=pixel-verde";

describe("AvatarForm", () => {
  it("renderiza as abas de estilo", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(screen.getByRole("tab", { name: /emoji/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /aventureiro/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /robô/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pixel/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /lorelei/i })).toBeInTheDocument();
  });

  it("a aba do estilo atual começa selecionada", () => {
    render(<AvatarForm avatarAtual={avatarPixelArt} />);
    expect(screen.getByRole("tab", { name: /pixel/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("renderiza 6 opções de avatar no grid", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("trocar de aba atualiza o grid de avatares", async () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    const abaRobo = screen.getByRole("tab", { name: /robô/i });
    await userEvent.click(abaRobo);
    expect(abaRobo).toHaveAttribute("aria-selected", "true");
    // O grid ainda exibe 6 opções (agora do estilo bottts)
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("botão salvar desabilitado quando avatar selecionado é o atual", () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    expect(
      screen.getByRole("button", { name: /salvar avatar/i })
    ).toBeDisabled();
  });

  it("botão salvar habilitado ao selecionar avatar diferente", async () => {
    render(<AvatarForm avatarAtual={avatarFunEmoji} />);
    const opcoes = screen.getAllByRole("radio");
    // Seleciona o segundo avatar (diferente do atual)
    await userEvent.click(opcoes[1]);
    expect(
      screen.getByRole("button", { name: /salvar avatar/i })
    ).not.toBeDisabled();
  });
});
