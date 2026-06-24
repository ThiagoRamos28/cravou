import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "@/components/auth/onboarding-form";

const avatares = ["https://x/1", "https://x/2", "https://x/3"];

describe("OnboardingForm", () => {
  it("mostra campo de apelido e as opções de avatar", () => {
    render(
      <OnboardingForm avatares={avatares} apelidoInicial="" avatarInicial={avatares[0]} />
    );
    expect(screen.getByLabelText(/apelido/i)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("seleciona um avatar ao clicar", async () => {
    render(
      <OnboardingForm avatares={avatares} apelidoInicial="" avatarInicial={avatares[0]} />
    );
    const opcoes = screen.getAllByRole("radio");
    await userEvent.click(opcoes[1]);
    expect(opcoes[1]).toBeChecked();
  });
});
