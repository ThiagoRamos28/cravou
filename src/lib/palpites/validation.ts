import { z } from "zod";

// coerce: FormData entrega strings; convertemos pra número e validamos inteiro >= 0
const placar = z.coerce
  .number({ message: "Informe um placar válido." })
  .int("O placar deve ser um número inteiro.")
  .min(0, "O placar não pode ser negativo.");

export const palpiteSchema = z.object({
  palpite_casa: placar,
  palpite_fora: placar,
});

export type Palpite = z.infer<typeof palpiteSchema>;
