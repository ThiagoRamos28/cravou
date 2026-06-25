import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ConfigRow } from "@/lib/config";

// Mocks no nível do módulo (hoisted pelo Vitest)
const mockToast = vi.fn();
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/app/admin/config/actions", () => ({ salvarConfiguracoes: vi.fn() }));

const mockUseActionState = vi.fn();
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: mockUseActionState };
});

// Import dinâmico após os mocks
const { ConfigForm } = await import("@/components/admin/config-form");

const CONFIG: ConfigRow[] = [
  { chave: "minutos_corte", valor: 10 },
  { chave: "pts_placar_exato", valor: 10 },
  { chave: "pts_saldo", valor: 7 },
  { chave: "pts_resultado", valor: 5 },
  { chave: "pts_gols_time", valor: 2 },
];

describe("ConfigForm", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
  });

  it("renderiza os 5 campos com valores iniciais", () => {
    render(<ConfigForm config={CONFIG} />);
    expect(screen.getByLabelText(/corte/i)).toHaveValue(10);
    expect(screen.getByLabelText(/placar exato/i)).toHaveValue(10);
    expect(screen.getByLabelText(/saldo/i)).toHaveValue(7);
    expect(screen.getByLabelText(/resultado v\/e\/d/i)).toHaveValue(5);
    expect(screen.getByLabelText(/gols de um time/i)).toHaveValue(2);
  });

  it("exibe erro inline quando estado.erro está presente", () => {
    mockUseActionState.mockReturnValue([{ erro: "Hierarquia de pontos inválida" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Hierarquia de pontos inválida");
  });

  it("chama toast de sucesso quando estado.ok está presente", () => {
    mockUseActionState.mockReturnValue([{ ok: "Configurações salvas!" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(mockToast).toHaveBeenCalledWith({ message: "Configurações salvas!", variant: "success" });
  });

  it("chama toast de erro quando estado.erro está presente", () => {
    mockUseActionState.mockReturnValue([{ erro: "Erro ao salvar" }, vi.fn(), false]);
    render(<ConfigForm config={CONFIG} />);
    expect(mockToast).toHaveBeenCalledWith({ message: "Erro ao salvar", variant: "error" });
  });
});
