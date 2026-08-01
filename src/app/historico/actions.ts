"use server";

import { getSessao } from "@/lib/auth/profile";
import { listarHistorico } from "@/lib/historico-dados";
import type { ItemHistorico } from "@/lib/historico";

// Página seguinte do histórico. O usuário vem da sessão, nunca do cliente — o id de usuário
// jamais é parâmetro de uma action que lista palpites.
export async function carregarMaisHistorico(params: {
  competicaoId: string;
  de?: string;
  ate?: string;
  ordem: "asc" | "desc";
  offset: number;
}): Promise<ItemHistorico[]> {
  const sessao = await getSessao();
  if (!sessao) return [];
  const { itens } = await listarHistorico({ ...params, userId: sessao.userId });
  return itens;
}
