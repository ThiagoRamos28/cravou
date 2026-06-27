"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { FollowButton } from "@/components/perfil/follow-button";
import { avatarPadrao } from "@/lib/avatars";
import type { UsuarioComFollow } from "@/lib/feed";

type UsuariosListProps = { usuarios: UsuarioComFollow[] };

export function UsuariosList({ usuarios }: UsuariosListProps) {
  const [filtro, setFiltro] = useState("");

  const filtrados = filtro.trim()
    ? usuarios.filter((u) =>
        u.apelido.toLowerCase().includes(filtro.trim().toLowerCase())
      )
    : usuarios;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Buscar por apelido..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filtrados.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {filtro ? "Nenhum usuário encontrado." : "Nenhum outro membro ainda."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtrados.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <Link
              href={`/perfil/${u.id}`}
              className="flex min-w-0 items-center gap-3 hover:underline"
            >
              <img
                src={u.avatar_url ?? avatarPadrao(u.id)}
                alt={u.apelido}
                width={36}
                height={36}
                className="shrink-0 rounded-full"
              />
              <span className="truncate font-medium">{u.apelido}</span>
            </Link>
            <FollowButton followingId={u.id} isSeguindoInicial={u.ja_sigo} />
          </li>
        ))}
      </ul>
    </div>
  );
}
