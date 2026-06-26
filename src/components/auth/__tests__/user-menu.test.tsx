import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/auth/user-menu";

const props = { apelido: "Zezão", avatarUrl: "https://x/avatar.svg" };

describe("UserMenu", () => {
  it("exibe o apelido no trigger", () => {
    render(<UserMenu {...props} />);
    expect(screen.getByText("Zezão")).toBeInTheDocument();
  });

  it("dropdown começa fechado", () => {
    render(<UserMenu {...props} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("abre o dropdown ao clicar no trigger", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("exibe links de Editar perfil e Sair", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menuitem", { name: /editar perfil/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sair/i })).toBeInTheDocument();
  });

  it("link Editar perfil aponta para /perfil", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    const link = screen.getByRole("menuitem", { name: /editar perfil/i });
    expect(link).toHaveAttribute("href", "/perfil");
  });

  it("fecha ao pressionar Escape", async () => {
    render(<UserMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha ao clicar fora do componente", async () => {
    render(
      <div>
        <UserMenu {...props} />
        <button>Fora</button>
      </div>
    );
    await userEvent.click(screen.getByRole("button", { name: /zezão/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /fora/i }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
