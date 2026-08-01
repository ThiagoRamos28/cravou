import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Match } from "@/lib/matches";
import { JOGOS_POR_PAGINA } from "@/lib/jogos/constantes";

const carregarMais = vi.fn();
// O MatchCard, renderizado aqui dentro, importa `salvarPalpite` do mesmo módulo — o mock
// precisa expor as duas, senão o vitest reclama do export que falta.
vi.mock("@/app/jogos/actions", () => ({
  carregarMaisJogos: (...args: unknown[]) => carregarMais(...args),
  salvarPalpite: vi.fn(async () => ({})),
}));

// Mesmo padrão de match-card.test.tsx: o PalpiteForm usa useToast, que exigiria o provider.
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { JogosLista } from "@/components/jogos/jogos-lista";

function jogo(id: string): Match {
  return {
    id,
    fase: "grupos",
    rodada: "",
    time_casa: `Casa ${id}`,
    time_fora: `Fora ${id}`,
    bandeira_casa: null,
    bandeira_fora: null,
    inicio_em: "2026-09-01T20:00:00Z",
    status: "agendado",
    placar_casa: null,
    placar_fora: null,
    odds: null,
  };
}

const pagina = (n: number) => Array.from({ length: n }, (_, i) => jogo(`j${i}`));

const props = {
  palpites: {},
  minutosCorte: 10,
  formaPorTime: new Map(),
  filtro: { competicaoId: "c1", situacao: "a_fazer" as const, ordem: "asc" as const },
};

describe("JogosLista", () => {
  beforeEach(() => carregarMais.mockReset());

  it("não mostra Carregar mais quando a 1ª página veio incompleta", () => {
    render(<JogosLista jogosIniciais={pagina(3)} {...props} />);
    expect(screen.queryByRole("button", { name: /carregar mais/i })).toBeNull();
  });

  it("mostra Carregar mais quando a 1ª página veio cheia", () => {
    render(<JogosLista jogosIniciais={pagina(JOGOS_POR_PAGINA)} {...props} />);
    expect(screen.getByRole("button", { name: /carregar mais/i })).toBeInTheDocument();
  });

  it("acumula a página seguinte e pede o offset certo", async () => {
    carregarMais.mockResolvedValue([jogo("novo")]);
    render(<JogosLista jogosIniciais={pagina(JOGOS_POR_PAGINA)} {...props} />);

    await userEvent.click(screen.getByRole("button", { name: /carregar mais/i }));

    expect(carregarMais).toHaveBeenCalledWith(
      expect.objectContaining({ offset: JOGOS_POR_PAGINA })
    );
    // O MatchCard repete o nome do time (rótulo visível + label sr-only do placar), então
    // a asserção é sobre existir ao menos uma ocorrência, não sobre ser única.
    expect((await screen.findAllByText(/Casa novo/)).length).toBeGreaterThan(0);
    // veio menos que a página cheia: não há mais o que carregar
    expect(screen.queryByRole("button", { name: /carregar mais/i })).toBeNull();
  });

  it("estado vazio quando não há jogo algum", () => {
    render(<JogosLista jogosIniciais={[]} {...props} />);
    expect(screen.getByText(/nenhum jogo/i)).toBeInTheDocument();
  });
});
