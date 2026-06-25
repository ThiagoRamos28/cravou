// Classifica um jogo numa rodada pelos blocos de data (fallback quando a API
// não traz a rodada). `ate` é o fim exclusivo do bloco (ISO). Blocos em ordem.
export function rodadaPorData(
  inicioEm: string,
  blocos: { rodada: string; ate: string }[]
): string {
  const t = new Date(inicioEm).getTime();
  for (const b of blocos) {
    if (t < new Date(b.ate).getTime()) return b.rodada;
  }
  return "";
}
