// Avatares gerados por URL (DiceBear) — sem upload/armazenamento.
const BASE = "https://api.dicebear.com/9.x/fun-emoji/svg?seed=";

const SEEDS = ["gol", "craque", "artilheiro", "zaga", "goleiro", "torcida"];

export const AVATAR_OPTIONS: string[] = SEEDS.map(
  (s) => `${BASE}${encodeURIComponent(s)}`
);

export function avatarPadrao(seed: string): string {
  return `${BASE}${encodeURIComponent(seed || "torcida")}`;
}
