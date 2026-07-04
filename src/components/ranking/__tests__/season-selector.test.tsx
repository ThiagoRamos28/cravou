import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonSelector } from "@/components/ranking/season-selector";

describe("SeasonSelector", () => {
  it("renderiza as 3 opções de período", () => {
    render(<SeasonSelector periodo="geral" onChange={() => {}} />);
    expect(screen.getByRole("option", { name: "Ranking Geral" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Temporada 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Temporada 2" })).toBeInTheDocument();
  });

  it("dispara onChange com o valor certo ao trocar o select", () => {
    const onChange = vi.fn();
    render(<SeasonSelector periodo="geral" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    expect(onChange).toHaveBeenCalledWith("temporada_2");
  });

  it("abre o popover ao clicar no botão de info e mostra a pontuação das duas temporadas", async () => {
    const user = userEvent.setup();
    render(<SeasonSelector periodo="geral" onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Pontuação das temporadas" }));
    expect(screen.getByText(/15 pts/)).toBeInTheDocument();
    expect(screen.getByText(/10 pts/)).toBeInTheDocument();
  });

  it("fecha o popover com Escape", async () => {
    const user = userEvent.setup();
    render(<SeasonSelector periodo="geral" onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Pontuação das temporadas" }));
    expect(screen.getByText(/15 pts/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText(/15 pts/)).not.toBeInTheDocument();
  });
});
