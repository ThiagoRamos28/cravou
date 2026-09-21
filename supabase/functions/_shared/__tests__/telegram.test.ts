import { describe, it, expect } from "vitest";
import { formatarMensagem, type DadosMensagem } from "../telegram";

const base: DadosMensagem = {
  timeCasa: "Flamengo RJ",
  timeFora: "Bragantino",
  competicao: "Brasileirão 2026",
  inicioEm: "2026-09-20T21:30:00.000Z",
  lambdas: { casa: 1.84, fora: 0.91 },
  resultado: { casa: 0.56, empate: 0.25, fora: 0.19 },
  sugestoes: [
    { casa: 2, fora: 0, prob: 0.121, pontosEsperados: 6.43, criterio: "maior-pontuacao" },
    { casa: 1, fora: 0, prob: 0.132, pontosEsperados: 6.1, criterio: "mais-provavel" },
    { casa: 1, fora: 1, prob: 0.105, pontosEsperados: 3.2, criterio: "alternativa" },
  ],
  formaCasa: { marcados: 2, sofridos: 0.8, jogos: 10, sequencia: "VEVVDVVEVV" },
  formaFora: { marcados: 1.1, sofridos: 1.4, jogos: 10, sequencia: "EDDVEVDEVD" },
  h2h: [
    { casa: "Bragantino", fora: "Flamengo RJ", gc: 3, gf: 0, data: "2026-04-03T00:00:00Z" },
    { casa: "Flamengo RJ", fora: "Bragantino", gc: 3, gf: 0, data: "2025-11-23T00:00:00Z" },
  ],
  fonte: "odds+forma",
  bookmaker: "bet365",
};

describe("formatarMensagem", () => {
  it("mostra o horário em Brasília", () => {
    const msg = formatarMensagem(base);
    expect(msg).toContain("20/09 às 18:30");
  });

  it("lista as 3 sugestões com probabilidade e pontos esperados", () => {
    const msg = formatarMensagem(base);
    expect(msg).toContain("<b>2 x 0</b>");
    expect(msg).toContain("<b>1 x 0</b>");
    expect(msg).toContain("<b>1 x 1</b>");
    expect(msg).toContain("12,1%");
    expect(msg).toContain("6,4 pts");
    expect(msg.indexOf("2 x 0")).toBeLessThan(msg.indexOf("1 x 0"));
  });

  it("inclui probabilidades de resultado, gols esperados, forma (5 últimos) e confronto", () => {
    const msg = formatarMensagem(base);
    expect(msg).toContain("56%");
    expect(msg).toContain("1,84");
    expect(msg).toContain("VEVVD");
    expect(msg).not.toContain("VEVVDV");
    expect(msg).toContain("Bragantino 3 x 0 Flamengo RJ");
  });

  it("escapa HTML dos nomes (parse_mode HTML do Telegram)", () => {
    const msg = formatarMensagem({ ...base, timeCasa: "A<b>&C" });
    expect(msg).toContain("A&lt;b&gt;&amp;C");
  });

  it("informa quando só a forma foi usada (sem odds)", () => {
    const msg = formatarMensagem({ ...base, fonte: "forma", bookmaker: undefined });
    expect(msg).toContain("sem odds");
  });

  it("tolera forma e confronto ausentes", () => {
    const msg = formatarMensagem({ ...base, formaCasa: null, formaFora: null, h2h: [] });
    expect(msg).toContain("2 x 0");
    expect(msg).not.toContain("Confronto");
  });
});
