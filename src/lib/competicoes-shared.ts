// Tipos/constantes de competição sem dependência de "next/headers".
// Isolados aqui para poderem ser importados por componentes client
// (ex.: CompeticaoSelector) sem puxar `@/lib/supabase/server` para o bundle do browser.
export type Competicao = {
  id: string;
  slug: string;
  nome: string;
  formato: "fases" | "pontos-corridos";
  ativa: boolean;
  ordem: number;
};

export const COOKIE_COMPETICAO = "competicao";
