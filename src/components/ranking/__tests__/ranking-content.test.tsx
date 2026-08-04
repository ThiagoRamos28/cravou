import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RankingContent } from "@/components/ranking/ranking-content";
import type { MesRanking, RankingRow } from "@/lib/ranking";
import { buscarRanking } from "@/app/ranking/actions";
import type { Competicao } from "@/lib/competicoes";

vi.mock("@/app/ranking/actions", () => ({ buscarRanking: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const competicao: Competicao = {
  id: "comp1", slug: "copa-2026", nome: "Copa 2026",
  formato: "fases", ativa: true, ordem: 1,
};

const brasileirao: Competicao = {
  id: "comp2", slug: "brasileirao-2026", nome: "Brasileirão 2026",
  formato: "pontos-corridos", ativa: true, ordem: 2,
};

const meses: MesRanking[] = [
  { mes: "2026-08", jogos: 40, pendentes: 40, palpites: 5, fechado: false },
  { mes: "2026-07", jogos: 32, pendentes: 0, palpites: 160, fechado: true },
];

const linhasIniciais: RankingRow[] = [
  {
    user_id: "u1", apelido: "Abacatão", avatar_url: null,
    pontos: 15, cravadas: 1, acertos_saldo: 0, acertos_resultado: 1,
    acertos_gols: 0, erros: 2, palpites_pontuados: 4, total_palpites: 5,
    pontos_max_total: 40,
  },
];

const linhasTemporada2: RankingRow[] = [
  {
    user_id: "u2", apelido: "Dannilo", avatar_url: null,
    pontos: 20, cravadas: 0, acertos_saldo: 1, acertos_resultado: 2,
    acertos_gols: 0, erros: 1, palpites_pontuados: 4, total_palpites: 4,
    pontos_max_total: 40,
  },
];

function renderCopa(props: Partial<ComponentProps<typeof RankingContent>> = {}) {
  return render(
    <RankingContent
      linhasIniciais={linhasIniciais}
      meuId="u1"
      competicao={competicao}
      competicoes={[competicao]}
      meses={[]}
      periodoInicial="geral"
      anoCorrente={2026}
      {...props}
    />
  );
}

function renderBrasileirao(props: Partial<ComponentProps<typeof RankingContent>> = {}) {
  return render(
    <RankingContent
      linhasIniciais={linhasIniciais}
      meuId="u1"
      competicao={brasileirao}
      competicoes={[brasileirao]}
      meses={meses}
      periodoInicial="2026-08"
      anoCorrente={2026}
      {...props}
    />
  );
}

describe("RankingContent", () => {
  beforeEach(() => {
    vi.mocked(buscarRanking).mockReset();
  });

  it("renderiza com linhasIniciais sem chamar a action", () => {
    renderCopa();
    expect(screen.getAllByText("Abacatão").length).toBeGreaterThan(0);
    expect(buscarRanking).not.toHaveBeenCalled();
  });

  it("ao trocar para temporada_2, chama buscarRanking e renderiza as novas linhas", async () => {
    vi.mocked(buscarRanking).mockResolvedValue(linhasTemporada2);
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    expect(buscarRanking).toHaveBeenCalledWith("comp1", "temporada_2");
    await waitFor(() => {
      expect(screen.getAllByText("Dannilo").length).toBeGreaterThan(0);
    });
  });

  it("em erro da action, some o skeleton e mantém as linhas anteriores", async () => {
    vi.mocked(buscarRanking).mockRejectedValue(new Error("conexão caiu"));
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_2" } });
    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Abacatão").length).toBeGreaterThan(0);
  });

  it("mostra o estado vazio de período não-mensal", async () => {
    vi.mocked(buscarRanking).mockResolvedValue([]);
    renderCopa();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "temporada_1" } });
    await waitFor(() => {
      expect(screen.getByText("Nenhum palpite pontuado neste período ainda.")).toBeInTheDocument();
    });
  });

  it("em formato 'fases' usa o SeasonSelector, não o seletor de mês", () => {
    renderCopa();
    expect(screen.getByRole("option", { name: "Temporada 1" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Julho" })).not.toBeInTheDocument();
  });

  it("em formato 'pontos-corridos' usa o seletor de mês, não o SeasonSelector", () => {
    renderBrasileirao();
    expect(screen.getByRole("option", { name: "Julho" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Temporada 1" })).not.toBeInTheDocument();
  });

  it("mostra a faixa do mês selecionado", () => {
    renderBrasileirao();
    expect(screen.getByText("Agosto em disputa")).toBeInTheDocument();
  });

  it("não mostra faixa quando o período é geral", () => {
    renderBrasileirao({ periodoInicial: "geral" });
    expect(screen.queryByText(/em disputa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Campeão de/)).not.toBeInTheDocument();
  });

  it("no estado vazio de um mês, nomeia o mês e não mostra a faixa", async () => {
    vi.mocked(buscarRanking).mockResolvedValue([]);
    renderBrasileirao();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-07" } });
    await waitFor(() => {
      expect(screen.getByText("Ninguém palpitou em Julho ainda.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Campeão de Julho/)).not.toBeInTheDocument();
  });
});
