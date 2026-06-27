import Link from "next/link";

export type MencaoPart = {
  tipo: "texto" | "mencao";
  valor: string;
  userId?: string;
};

export function parseMencoes(
  conteudo: string,
  perfis: Record<string, string>
): MencaoPart[] {
  const partes = conteudo.split(/(@\w+)/g);
  return partes
    .filter((p) => p.length > 0)
    .map((p): MencaoPart => {
      if (p.startsWith("@")) {
        const apelido = p.slice(1);
        const userId = perfis[apelido];
        if (userId) return { tipo: "mencao", valor: p, userId };
      }
      return { tipo: "texto", valor: p };
    });
}

type MencaoLinkProps = {
  conteudo: string;
  perfis: Record<string, string>;
};

export function MencaoLink({ conteudo, perfis }: MencaoLinkProps) {
  const partes = parseMencoes(conteudo, perfis);
  return (
    <>
      {partes.map((parte, i) =>
        parte.tipo === "mencao" && parte.userId ? (
          <Link
            key={i}
            href={`/perfil/${parte.userId}`}
            className="font-semibold text-primary hover:underline"
          >
            {parte.valor}
          </Link>
        ) : (
          <span key={i}>{parte.valor}</span>
        )
      )}
    </>
  );
}
