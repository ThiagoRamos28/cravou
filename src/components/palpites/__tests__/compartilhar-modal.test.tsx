import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompartilharModal } from "../compartilhar-modal";

vi.mock("@/app/feed/actions", () => ({
  publicarPost: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/i18n/paises", () => ({
  traduzirPais: (nome: string) => nome,
}));

const props = {
  jogoId: "jogo-1",
  timeCasa: "Brazil",
  timeFora: "Argentina",
  palpiteCasa: 2,
  palpiteFora: 1,
  onClose: vi.fn(),
};

describe("CompartilharModal", () => {
  it("exibe o mini-card com os times e placar do palpite", () => {
    render(<CompartilharModal {...props} />);
    expect(screen.getByText("Brazil")).toBeTruthy();
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.getByText("2 × 1")).toBeTruthy();
  });

  it("pré-preenche o textarea com texto de sugestão", () => {
    render(<CompartilharModal {...props} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("2 × 1");
  });

  it("botão Pular chama onClose sem publicar", async () => {
    const { publicarPost } = await import("@/app/feed/actions");
    render(<CompartilharModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /pular/i }));
    expect(props.onClose).toHaveBeenCalled();
    expect(publicarPost).not.toHaveBeenCalled();
  });

  it("botão Postar chama publicarPost com jogoId e fecha modal", async () => {
    const { publicarPost } = await import("@/app/feed/actions");
    render(<CompartilharModal {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /postar/i }));
    expect(publicarPost).toHaveBeenCalledWith(expect.any(String), "jogo-1");
    expect(props.onClose).toHaveBeenCalled();
  });
});
