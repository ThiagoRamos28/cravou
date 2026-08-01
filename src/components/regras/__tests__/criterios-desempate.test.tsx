import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CriteriosDesempate } from "@/components/regras/criterios-desempate";
import { CRITERIOS_DESEMPATE } from "@/lib/ranking-shared";

describe("CriteriosDesempate", () => {
  it("lista os seis critérios, na ordem", () => {
    render(<CriteriosDesempate />);
    const itens = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(itens).toHaveLength(6);
    CRITERIOS_DESEMPATE.forEach((c, i) => {
      expect(itens[i]).toContain(c);
    });
  });

  it("explica o que acontece no empate total", () => {
    render(<CriteriosDesempate />);
    expect(screen.getByText(/divide a posição/i)).toBeInTheDocument();
  });
});
