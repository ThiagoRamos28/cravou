// Tipos e funções puras do ranking, sem dependência de "next/headers".
// Isolados aqui para poderem ser importados por componentes client (MesSelector,
// FaixaCampeao) sem puxar `@/lib/supabase/server` para o bundle do browser —
// mesmo motivo que criou o competicoes-shared.ts.

export type RankingRow = {
  user_id: string;
  apelido: string | null;
  avatar_url: string | null;
  pontos: number;
  cravadas: number;
  acertos_saldo: number;
  acertos_resultado: number;
  acertos_gols: number;
  erros: number;
  palpites_pontuados: number;
  total_palpites: number;
  pontos_max_total: number;
};

export const PERIODOS_FIXOS = ["geral", "temporada_1", "temporada_2"] as const;
export type PeriodoFixo = (typeof PERIODOS_FIXOS)[number];
/** Mês em horário de Brasília, `YYYY-MM`. Quem garante o formato é `ehPeriodoMensal`. */
export type PeriodoMensal = `${number}-${number}`;
export type RankingPeriodo = PeriodoFixo | PeriodoMensal;

export type MesRanking = {
  mes: string;
  jogos: number;
  pendentes: number;
  palpites: number;
  fechado: boolean;
};

export type Campeao = { nomes: string[]; pontos: number };

/** Os seis critérios de mérito do `order by` da função SQL `ranking()`, nessa ordem. */
export const CRITERIOS_DESEMPATE = [
  "Mais pontos",
  "Mais cravadas — placar exato",
  "Mais acertos de saldo — vencedor e diferença de gols",
  "Mais acertos de resultado — vitória, empate ou derrota",
  "Mais acertos de gols de um dos times",
  "Menos erros",
] as const;

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ehPeriodoMensal(periodo: string): periodo is PeriodoMensal {
  return RE_MES.test(periodo);
}

// Fronteira de confiança: o que vier de fora vira um período válido ou 'geral'.
export function normalizarPeriodo(periodo: string): RankingPeriodo {
  if ((PERIODOS_FIXOS as readonly string[]).includes(periodo)) return periodo as PeriodoFixo;
  if (ehPeriodoMensal(periodo)) return periodo;
  return "geral";
}

export function mesCorrenteBRT(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === "year")?.value ?? "";
  const mes = partes.find((p) => p.type === "month")?.value ?? "";
  return `${ano}-${mes}`;
}

// Só filtra e ordena — nunca inventa um mês que não veio do banco. Os meses do
// Brasileirão não são contíguos (não há junho), então nada aqui pode assumir sequência.
export function mesesVisiveis(meses: MesRanking[], mesCorrente: string): MesRanking[] {
  return meses
    .filter((m) => m.palpites > 0 || m.mes === mesCorrente)
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function rotuloMes(mes: string, anoCorrente: number): string {
  const [ano, num] = mes.split("-");
  const nome = NOMES_MES[Number(num) - 1];
  if (!nome) return mes;
  return Number(ano) === anoCorrente ? nome : `${nome}/${ano}`;
}

// Espelha a cascata da ranking(): só divide o título quem empata nos seis critérios de
// mérito. Os dois últimos níveis do order by (apelido, id) são ordenação estável, não
// desempate, e por isso ficam de fora daqui.
export function campeaoDoMes(linhas: RankingRow[]): Campeao | null {
  const topo = linhas[0];
  if (!topo || topo.pontos <= 0) return null;
  const nomes = linhas
    .filter(
      (l) =>
        l.pontos === topo.pontos &&
        l.cravadas === topo.cravadas &&
        l.acertos_saldo === topo.acertos_saldo &&
        l.acertos_resultado === topo.acertos_resultado &&
        l.acertos_gols === topo.acertos_gols &&
        l.erros === topo.erros
    )
    .map((l) => l.apelido ?? "Sem apelido");
  return { nomes, pontos: topo.pontos };
}
