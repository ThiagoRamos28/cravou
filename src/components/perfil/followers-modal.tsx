"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { avatarPadrao } from "@/lib/avatars";
import type { PerfilBasico } from "@/lib/feed";

type Aba = "seguidores" | "seguindo";

type FollowersModalProps = {
  seguidores: PerfilBasico[];
  seguindo: PerfilBasico[];
  abaInicial?: Aba;
  onClose: () => void;
};

export function FollowersModal({
  seguidores,
  seguindo,
  abaInicial = "seguidores",
  onClose,
}: FollowersModalProps) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const lista = aba === "seguidores" ? seguidores : seguindo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => setAba("seguidores")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                aba === "seguidores"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Seguidores
            </button>
            <button
              onClick={() => setAba("seguindo")}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                aba === "seguindo"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Seguindo
            </button>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum {aba === "seguidores" ? "seguidor" : "seguindo"} ainda.
            </p>
          )}
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/perfil/${p.id}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"
            >
              <img
                src={p.avatar_url ?? avatarPadrao(p.id)}
                alt={p.apelido}
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-sm font-medium">{p.apelido}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
