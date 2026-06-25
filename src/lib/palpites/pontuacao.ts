// Pontuação de um palpite — modelo "pega a maior" (5 níveis), espelha a função
// SQL public.pontos_palpite. Os valores são configuráveis (vêm de app_config).
export type ConfigPontos = {
  ptsExato: number;
  ptsSaldo: number;
  ptsResultado: number;
  ptsGols: number;
};

const PADRAO: ConfigPontos = {
  ptsExato: 10,
  ptsSaldo: 7,
  ptsResultado: 5,
  ptsGols: 2,
};

export function pontuar(
  palpiteCasa: number,
  palpiteFora: number,
  placarCasa: number,
  placarFora: number,
  cfg: ConfigPontos = PADRAO
): number {
  const mesmoResultado =
    Math.sign(palpiteCasa - palpiteFora) === Math.sign(placarCasa - placarFora);

  // 1: placar exato
  if (palpiteCasa === placarCasa && palpiteFora === placarFora) return cfg.ptsExato;
  // 2: vitória (não empate), vencedor certo E diferença de gols exata
  if (
    placarCasa !== placarFora &&
    mesmoResultado &&
    palpiteCasa - palpiteFora === placarCasa - placarFora
  ) {
    return cfg.ptsSaldo;
  }
  // 3: resultado V/E/D (mesmo sinal de casa − fora)
  if (mesmoResultado) return cfg.ptsResultado;
  // 4: errou o resultado, mas acertou os gols de um dos times
  if (palpiteCasa === placarCasa || palpiteFora === placarFora) return cfg.ptsGols;
  return 0;
}
