// Modelo estatístico de placar para as sugestões enviadas no Telegram. Sem I/O — testável.
//
// Ideia: estimar a média de gols de cada time (λ) a partir das odds (mercado) e da forma
// recente, montar a distribuição de probabilidade de cada placar (Poisson com ajuste
// Dixon-Coles para placares baixos) e escolher os palpites que maximizam a pontuação esperada
// segundo a regra REAL do bolão (espelho de public.pontos_palpite).

export type RegraPontos = { exato: number; saldo: number; resultado: number; gols: number };

export type Lambdas = { casa: number; fora: number };

export type OddsEntrada = {
  casa: string | null;
  empate: string | null;
  fora: string | null;
  over25?: string | null;
  under25?: string | null;
};

// Formato de cada jogo em matches/h2h?grouped=true (FlashScore). Placar vem como string.
export type JogoH2H = {
  match_id: string;
  status: string;
  timestamp: number;
  home_team: { name: string };
  away_team: { name: string };
  scores: { home: string | number | null; away: string | number | null };
};

export type Sugestao = {
  casa: number;
  fora: number;
  prob: number; // P(placar exato)
  pontosEsperados: number;
  criterio: "maior-pontuacao" | "mais-provavel" | "alternativa";
};

const MAX_GOLS = 7; // matriz 0..7 — o resto da cauda é desprezível e renormalizado
const RHO_PADRAO = -0.1; // Dixon-Coles: leve correlação negativa infla 0x0/1x1
const FATOR_CASA = 1.1;
const FATOR_FORA = 0.9;
const JOGOS_FORMA = 10;
const MAX_PALPITE = 5; // palpites candidatos: 0..5 gols por time

// Espelho de public.pontos_palpite (ordem das regras importa).
export function pontosPalpite(
  pc: number,
  pf: number,
  rc: number,
  rf: number,
  r: RegraPontos
): number {
  if (pc === rc && pf === rf) return r.exato;
  const sp = Math.sign(pc - pf);
  const sr = Math.sign(rc - rf);
  if (rc !== rf && sp === sr && pc - pf === rc - rf) return r.saldo;
  if (sp === sr) return r.resultado;
  if (pc === rc || pf === rf) return r.gols;
  return 0;
}

function poisson(k: number, l: number): number {
  let fat = 1;
  for (let i = 2; i <= k; i++) fat *= i;
  return (Math.exp(-l) * Math.pow(l, k)) / fat;
}

function tau(c: number, f: number, lc: number, lf: number, rho: number): number {
  if (c === 0 && f === 0) return 1 - lc * lf * rho;
  if (c === 0 && f === 1) return 1 + lc * rho;
  if (c === 1 && f === 0) return 1 + lf * rho;
  if (c === 1 && f === 1) return 1 - rho;
  return 1;
}

// m[c][f] = P(casa marca c, fora marca f), normalizada para somar 1.
export function matrizPlacares(lc: number, lf: number, rho = RHO_PADRAO): number[][] {
  const m: number[][] = [];
  let total = 0;
  for (let c = 0; c <= MAX_GOLS; c++) {
    m.push([]);
    for (let f = 0; f <= MAX_GOLS; f++) {
      const p = Math.max(0, poisson(c, lc) * poisson(f, lf) * tau(c, f, lc, lf, rho));
      m[c].push(p);
      total += p;
    }
  }
  return m.map((linha) => linha.map((p) => p / total));
}

export function probResultado(m: number[][]): { casa: number; empate: number; fora: number } {
  let casa = 0;
  let empate = 0;
  let fora = 0;
  m.forEach((linha, c) =>
    linha.forEach((p, f) => {
      if (c > f) casa += p;
      else if (c === f) empate += p;
      else fora += p;
    })
  );
  return { casa, empate, fora };
}

export function probOver25(m: number[][]): number {
  let p = 0;
  m.forEach((linha, c) => linha.forEach((x, f) => (c + f >= 3 ? (p += x) : 0)));
  return p;
}

function num(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n : null;
}

// Converte odds em λ: tira a margem (normaliza as probabilidades implícitas) e busca em grade
// o par (λcasa, λfora) cuja matriz reproduz melhor P(casa), P(fora) e P(over 2.5).
export function lambdasDasOdds(odds: OddsEntrada | null): Lambdas | null {
  if (!odds) return null;
  const oc = num(odds.casa);
  const oe = num(odds.empate);
  const of = num(odds.fora);
  if (oc === null || oe === null || of === null) return null;

  const soma1x2 = 1 / oc + 1 / oe + 1 / of;
  const alvoCasa = 1 / oc / soma1x2;
  const alvoFora = 1 / of / soma1x2;

  const oo = num(odds.over25);
  const ou = num(odds.under25);
  const alvoOver = oo !== null && ou !== null ? 1 / oo / (1 / oo + 1 / ou) : null;

  const erro = (lc: number, lf: number): number => {
    const m = matrizPlacares(lc, lf);
    const r = probResultado(m);
    let e = (r.casa - alvoCasa) ** 2 + (r.fora - alvoFora) ** 2;
    if (alvoOver !== null) e += (probOver25(m) - alvoOver) ** 2;
    return e;
  };

  // Grade grossa + refinamento local (barato o bastante para rodar por jogo na Edge Function).
  let melhor = { casa: 1.3, fora: 1.1, e: Infinity };
  for (let lc = 0.2; lc <= 4.0; lc += 0.1) {
    for (let lf = 0.2; lf <= 4.0; lf += 0.1) {
      const e = erro(lc, lf);
      if (e < melhor.e) melhor = { casa: lc, fora: lf, e };
    }
  }
  const base = { ...melhor };
  for (let lc = base.casa - 0.1; lc <= base.casa + 0.1; lc += 0.01) {
    for (let lf = base.fora - 0.1; lf <= base.fora + 0.1; lf += 0.01) {
      if (lc <= 0.05 || lf <= 0.05) continue;
      const e = erro(lc, lf);
      if (e < melhor.e) melhor = { casa: lc, fora: lf, e };
    }
  }
  return { casa: melhor.casa, fora: melhor.fora };
}

function gols(v: string | number | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Nome do time dono da lista: o informado, se aparecer nela; senão o mais frequente.
function resolverTime(jogos: JogoH2H[], nome: string): string {
  if (jogos.some((j) => j.home_team.name === nome || j.away_team.name === nome)) return nome;
  const cont = new Map<string, number>();
  for (const j of jogos) {
    for (const n of [j.home_team.name, j.away_team.name]) cont.set(n, (cont.get(n) ?? 0) + 1);
  }
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? nome;
}

export type Forma = { marcados: number; sofridos: number; jogos: number; sequencia: string };

// Média de gols pró/contra nos últimos N jogos finalizados + sequência V/E/D (mais recente 1º).
export function formaDoTime(
  jogos: JogoH2H[],
  matchIdAlvo: string,
  nome: string,
  n = JOGOS_FORMA
): Forma | null {
  const time = resolverTime(jogos, nome);
  const validos = jogos
    .filter((j) => j.match_id !== matchIdAlvo && j.status === "FINISHED")
    .filter((j) => gols(j.scores.home) !== null && gols(j.scores.away) !== null)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, n);
  if (validos.length === 0) return null;

  let marcados = 0;
  let sofridos = 0;
  let sequencia = "";
  for (const j of validos) {
    const emCasa = j.home_team.name === time;
    const pro = emCasa ? gols(j.scores.home)! : gols(j.scores.away)!;
    const contra = emCasa ? gols(j.scores.away)! : gols(j.scores.home)!;
    marcados += pro;
    sofridos += contra;
    sequencia += pro > contra ? "V" : pro === contra ? "E" : "D";
  }
  return {
    marcados: marcados / validos.length,
    sofridos: sofridos / validos.length,
    jogos: validos.length,
    sequencia,
  };
}

// λ pela forma: ataque de um × defesa do outro, com leve vantagem de mando.
export function lambdasDaForma(
  ultimosCasa: JogoH2H[],
  ultimosFora: JogoH2H[],
  matchIdAlvo: string,
  timeCasa: string,
  timeFora: string
): Lambdas | null {
  const fc = formaDoTime(ultimosCasa, matchIdAlvo, timeCasa);
  const ff = formaDoTime(ultimosFora, matchIdAlvo, timeFora);
  if (!fc || !ff) return null;
  return {
    casa: Math.max(0.2, ((fc.marcados + ff.sofridos) / 2) * FATOR_CASA),
    fora: Math.max(0.2, ((ff.marcados + fc.sofridos) / 2) * FATOR_FORA),
  };
}

// Mistura: o mercado costuma ser o melhor preditor, a forma entra como ajuste fino.
export function combinarLambdas(odds: Lambdas | null, forma: Lambdas | null): Lambdas | null {
  if (odds && forma) {
    return {
      casa: 0.7 * odds.casa + 0.3 * forma.casa,
      fora: 0.7 * odds.fora + 0.3 * forma.fora,
    };
  }
  return odds ?? forma;
}

function pontosEsperados(m: number[][], c: number, f: number, r: RegraPontos): number {
  let ep = 0;
  m.forEach((linha, rc) => linha.forEach((p, rf) => (ep += p * pontosPalpite(c, f, rc, rf, r))));
  return ep;
}

// 3 opções: (1) maior pontuação esperada; (2) placar exato mais provável (≠ 1ª);
// (3) melhor pontuação esperada num resultado (V/E/D) diferente do da 1ª.
export function sugerirPlacares(m: number[][], regra: RegraPontos): Sugestao[] {
  const candidatos: Omit<Sugestao, "criterio">[] = [];
  for (let c = 0; c <= MAX_PALPITE; c++) {
    for (let f = 0; f <= MAX_PALPITE; f++) {
      candidatos.push({ casa: c, fora: f, prob: m[c][f], pontosEsperados: pontosEsperados(m, c, f, regra) });
    }
  }
  const mesmo = (a: { casa: number; fora: number }, b: { casa: number; fora: number }) =>
    a.casa === b.casa && a.fora === b.fora;
  const sinal = (x: { casa: number; fora: number }) => Math.sign(x.casa - x.fora);

  const porEP = [...candidatos].sort((a, b) => b.pontosEsperados - a.pontosEsperados);
  const porProb = [...candidatos].sort((a, b) => b.prob - a.prob);

  const primeira = porEP[0];
  const segunda = porProb.find((x) => !mesmo(x, primeira))!;

  // Resultado alternativo: o mais provável entre os que não são o da 1ª opção.
  const r = probResultado(m);
  const resultados = [
    { s: 1, p: r.casa },
    { s: 0, p: r.empate },
    { s: -1, p: r.fora },
  ].filter((x) => x.s !== sinal(primeira));
  resultados.sort((a, b) => b.p - a.p);
  const terceira = porEP.find(
    (x) => sinal(x) === resultados[0].s && !mesmo(x, primeira) && !mesmo(x, segunda)
  )!;

  return [
    { ...primeira, criterio: "maior-pontuacao" },
    { ...segunda, criterio: "mais-provavel" },
    { ...terceira, criterio: "alternativa" },
  ];
}
