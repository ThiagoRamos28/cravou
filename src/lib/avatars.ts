const BASE = "https://api.dicebear.com/9.x/";

export const ESTILOS_AVATAR: Record<string, string[]> = {
  "fun-emoji":  ["gol", "craque", "artilheiro", "zaga", "goleiro", "torcida"],
  "adventurer": ["camisa10", "meiocampo", "lateral", "zagueiro", "atacante", "reserva"],
  "bottts":     ["robo-gol", "robo-passe", "robo-chute", "robo-falta", "robo-escanteio", "robo-impedimento"],
  "pixel-art":  ["pixel-verde", "pixel-laranja", "pixel-azul", "pixel-branco", "pixel-amarelo", "pixel-vermelho"],
  "lorelei":    ["torcedora", "tecnica", "arbitro", "mascote", "comentarista", "repórter"],
};

export function avatarUrlFromEstilo(estilo: string, seed: string): string {
  return `${BASE}${estilo}/svg?seed=${encodeURIComponent(seed)}`;
}

export function estiloDoAvatar(url: string): string {
  const match = url.match(/dicebear\.com\/9\.x\/([^/]+)\/svg/);
  const estilo = match?.[1] ?? "fun-emoji";
  return estilo in ESTILOS_AVATAR ? estilo : "fun-emoji";
}

export const AVATAR_OPTIONS: string[] = (ESTILOS_AVATAR["fun-emoji"] ?? []).map(
  (seed) => avatarUrlFromEstilo("fun-emoji", seed)
);

export function avatarPadrao(seed: string): string {
  return avatarUrlFromEstilo("fun-emoji", seed || "torcida");
}
