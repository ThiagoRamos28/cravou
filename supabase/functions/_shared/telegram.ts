// Mensagem de sugestões de placar para o Telegram (parse_mode HTML). Sem I/O — testável.
import type { Forma, Lambdas, Sugestao } from "./palpite-modelo.ts";

export type JogoConfronto = { casa: string; fora: string; gc: number; gf: number; data: string };

export type DadosMensagem = {
  timeCasa: string;
  timeFora: string;
  competicao: string;
  inicioEm: string; // ISO UTC
  lambdas: Lambdas;
  resultado: { casa: number; empate: number; fora: number };
  sugestoes: Sugestao[];
  formaCasa: Forma | null;
  formaFora: Forma | null;
  h2h: JogoConfronto[]; // mais recente primeiro
  fonte: "odds+forma" | "odds" | "forma";
  bookmaker?: string;
};

const ROTULO: Record<Sugestao["criterio"], string> = {
  "maior-pontuacao": "maior pontuação esperada",
  "mais-provavel": "placar mais provável",
  alternativa: "alternativa (outro resultado)",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pct(p: number, casas = 0): string {
  return `${(p * 100).toFixed(casas).replace(".", ",")}%`;
}

function dec(n: number, casas: number): string {
  return n.toFixed(casas).replace(".", ",");
}

function quando(iso: string): string {
  const d = new Date(iso);
  const tz = { timeZone: "America/Sao_Paulo" } as const;
  const data = d.toLocaleDateString("pt-BR", { ...tz, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

export function formatarMensagem(d: DadosMensagem): string {
  const casa = esc(d.timeCasa);
  const fora = esc(d.timeFora);
  const linhas: string[] = [];

  linhas.push(`⚽ <b>${casa} x ${fora}</b>`);
  linhas.push(`${esc(d.competicao)} · ${quando(d.inicioEm)} (Brasília)`);
  linhas.push("");
  linhas.push("<b>Sugestões</b>");
  d.sugestoes.forEach((s, i) => {
    linhas.push(
      `${i + 1}. <b>${s.casa} x ${s.fora}</b> — ${ROTULO[s.criterio]}\n` +
        `    ${pct(s.prob, 1)} de cravar · ${dec(s.pontosEsperados, 1)} pts esperados`
    );
  });
  linhas.push("");
  linhas.push(
    `<b>Probabilidades</b>: ${casa} ${pct(d.resultado.casa)} · Empate ${pct(d.resultado.empate)} · ${fora} ${pct(d.resultado.fora)}`
  );
  linhas.push(`Gols esperados: ${dec(d.lambdas.casa, 2)} x ${dec(d.lambdas.fora, 2)}`);

  if (d.formaCasa || d.formaFora) {
    linhas.push("");
    linhas.push("<b>Forma</b> (5 últimos, mais recente à esquerda)");
    if (d.formaCasa) {
      linhas.push(
        `${casa}: ${d.formaCasa.sequencia.slice(0, 5)} · ${dec(d.formaCasa.marcados, 1)} gols pró / ${dec(d.formaCasa.sofridos, 1)} contra`
      );
    }
    if (d.formaFora) {
      linhas.push(
        `${fora}: ${d.formaFora.sequencia.slice(0, 5)} · ${dec(d.formaFora.marcados, 1)} gols pró / ${dec(d.formaFora.sofridos, 1)} contra`
      );
    }
  }

  if (d.h2h.length > 0) {
    linhas.push("");
    linhas.push("<b>Confronto direto</b>");
    for (const j of d.h2h.slice(0, 5)) {
      const ano = new Date(j.data).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        month: "2-digit",
        year: "2-digit",
      });
      linhas.push(`${ano}: ${esc(j.casa)} ${j.gc} x ${j.gf} ${esc(j.fora)}`);
    }
  }

  linhas.push("");
  const base =
    d.fonte === "forma"
      ? "forma recente (sem odds disponíveis)"
      : d.fonte === "odds"
        ? `odds ${esc(d.bookmaker ?? "")}`.trim()
        : `odds ${esc(d.bookmaker ?? "")} + forma recente`.replace("  ", " ");
  linhas.push(`<i>Modelo Poisson/Dixon-Coles · base: ${base}</i>`);

  return linhas.join("\n");
}
