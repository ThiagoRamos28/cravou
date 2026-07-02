import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreStepper } from "@/components/ui/score-stepper";

function setup(defaultValue?: number) {
  render(
    <ScoreStepper id="casa-m1" name="palpite_casa" label="Palpite Brasil" defaultValue={defaultValue} />
  );
  return {
    input: screen.getByLabelText("Palpite Brasil") as HTMLInputElement,
    mais: screen.getByRole("button", { name: /aumentar palpite brasil/i }),
    menos: screen.getByRole("button", { name: /diminuir palpite brasil/i }),
  };
}

describe("ScoreStepper", () => {
  it("incrementa com o botão +", () => {
    const { input, mais } = setup(1);
    fireEvent.click(mais);
    expect(input.value).toBe("2");
  });

  it("decrementa com o botão − e não desce de 0", () => {
    const { input, menos } = setup(1);
    fireEvent.click(menos);
    expect(input.value).toBe("0");
    expect(menos).toBeDisabled();
  });

  it("campo vazio vira 0 ao usar +", () => {
    const { input, mais } = setup();
    expect(input.value).toBe("");
    fireEvent.click(mais);
    expect(input.value).toBe("1");
  });

  it("aceita apenas dígitos na digitação direta", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "2a" } });
    expect(input.value).toBe("2");
  });

  it("expõe name e id para o submit do form", () => {
    const { input } = setup(3);
    expect(input).toHaveAttribute("name", "palpite_casa");
    expect(input).toHaveAttribute("id", "casa-m1");
    expect(input.value).toBe("3");
  });
});
