// true enquanto ainda dá pra palpitar: agora < inicio_em - minutosCorte
export function palpiteAberto(
  inicioEm: string,
  minutosCorte: number,
  agora: Date = new Date()
): boolean {
  const corte = new Date(new Date(inicioEm).getTime() - minutosCorte * 60_000);
  return agora.getTime() < corte.getTime();
}
