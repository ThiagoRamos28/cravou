import { z } from "zod";

export const credenciaisSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

export const magicLinkSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

export const perfilSchema = z.object({
  apelido: z
    .string()
    .trim()
    .min(2, "O apelido deve ter ao menos 2 caracteres.")
    .max(20, "O apelido deve ter no máximo 20 caracteres."),
  avatar_url: z.string().min(1, "Escolha um avatar."),
});

export const atualizarSenhaSchema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual."),
    senha_nova: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
    confirmar: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.senha_nova === d.confirmar, {
    message: "As senhas não coincidem.",
    path: ["confirmar"],
  });

export type Credenciais = z.infer<typeof credenciaisSchema>;
export type MagicLink = z.infer<typeof magicLinkSchema>;
export type Perfil = z.infer<typeof perfilSchema>;
export type AtualizarSenha = z.infer<typeof atualizarSenhaSchema>;

type Resultado<T> =
  | { sucesso: true; dados: T }
  | { sucesso: false; erro: string };

export function validar<T>(schema: z.ZodType<T>, data: unknown): Resultado<T> {
  const r = schema.safeParse(data);
  if (r.success) return { sucesso: true, dados: r.data };
  return { sucesso: false, erro: r.error.issues[0]?.message ?? "Dados inválidos." };
}
