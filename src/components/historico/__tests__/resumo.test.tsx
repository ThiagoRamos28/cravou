import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Resumo } from "@/components/historico/resumo";

describe("Resumo", () => {
  it("mostra os três indicadores", () => {
    render(<Resumo totalPontos={15} cravadas={1} aproveitamento={0.5} />);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
