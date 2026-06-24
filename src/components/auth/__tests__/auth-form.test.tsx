import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/components/auth/auth-form";

describe("AuthForm", () => {
  it("começa na aba Entrar com campos de e-mail e senha", () => {
    render(<AuthForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it("na aba Link mágico esconde o campo de senha", async () => {
    render(<AuthForm />);
    await userEvent.click(screen.getByRole("tab", { name: /link mágico/i }));
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
});
