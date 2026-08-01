export type Situacao = "a_fazer" | "encerrados" | "todos";

// "2026-07-31" → "2026-08-01". Usa UTC de propósito: aqui só interessa a aritmética de
// calendário, não o instante — construir com fuso local viraria o dia em máquinas a oeste.
export function diaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// O usuário escolhe DIAS DO CALENDÁRIO DE BRASÍLIA; `inicio_em` é UTC. Comparar a data crua
// deixaria um jogo às 21h de 31/07 BRT (= 01/08 00:00 UTC) fora do filtro do dia 31.
// Por isso a fronteira carrega o offset explícito e o Postgres resolve a conversão.
// `ate` é INCLUSIVO: o limite superior é a meia-noite do dia seguinte, exclusiva.
export function limitesDeData(
  de?: string,
  ate?: string
): { gte?: string; lt?: string } {
  const limites: { gte?: string; lt?: string } = {};
  if (de) limites.gte = `${de}T00:00:00-03:00`;
  if (ate) limites.lt = `${diaSeguinte(ate)}T00:00:00-03:00`;
  return limites;
}

// `null` = nenhuma restrição de status (só o /admin pede isso, para poder corrigir jogo
// adiado/cancelado à mão). Fora daí, adiado e cancelado nunca entram numa listagem.
export function statusPorSituacao(
  situacao: Situacao,
  incluirNaoJogaveis: boolean
): string[] | null {
  if (situacao === "encerrados") return ["finalizado"];
  if (situacao === "a_fazer") return ["agendado", "ao_vivo"];
  return incluirNaoJogaveis ? null : ["agendado", "ao_vivo", "finalizado"];
}
