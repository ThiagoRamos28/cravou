import { createClient } from "@supabase/supabase-js";

// Espelha os escudos dos times num bucket público do Supabase (`escudos`), reescrevendo
// a URL da FlashScore para uma URL própria. A FlashScore responde 403 a hotlinks/datacenter,
// então servir do nosso storage garante que os escudos carreguem sempre.

const BUCKET = "escudos";

// Deriva um nome de arquivo estável a partir da URL da FlashScore (último segmento do path).
function nomeArquivo(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const seg = path.split("/").filter(Boolean).pop();
    return seg && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(seg) ? seg : null;
  } catch {
    return null;
  }
}

export function urlPublica(supabaseUrl: string, arquivo: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${arquivo}`;
}

// Espelha uma URL de escudo e devolve a URL pública no nosso storage.
// - Se a URL já apontar para o nosso storage (ou for nula/inválida), devolve como está.
// - Usa `cache` (por run) para não baixar/subir o mesmo arquivo duas vezes.
// - Falha aberta: em qualquer erro, devolve a URL original (não quebra o sync).
export async function espelharEscudo(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  url: string | null,
  cache: Map<string, string>
): Promise<string | null> {
  if (!url) return url;
  if (url.includes(`/storage/v1/object/public/${BUCKET}/`)) return url;

  const arquivo = nomeArquivo(url);
  if (!arquivo) return url;

  const jaFeito = cache.get(arquivo);
  if (jaFeito) return jaFeito;

  const destino = urlPublica(supabaseUrl, arquivo);

  try {
    // Se já existe no bucket, não rebaixa — só reaponta.
    const { data: existe } = await supabase.storage
      .from(BUCKET)
      .list("", { search: arquivo, limit: 1 });
    if (existe && existe.some((f) => f.name === arquivo)) {
      cache.set(arquivo, destino);
      return destino;
    }

    const resp = await fetch(url);
    if (!resp.ok) return url;
    const contentType = resp.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await resp.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(arquivo, bytes, { contentType, upsert: true });
    if (error) return url;

    cache.set(arquivo, destino);
    return destino;
  } catch {
    return url;
  }
}
