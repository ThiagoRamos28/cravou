"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Heart, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { MencaoLink } from "./mencao-link";
import { alternarCurtida, deletarPost } from "@/app/feed/actions";
import { avatarPadrao } from "@/lib/avatars";
import type { PostFeed } from "@/lib/feed";

function tempoRelativo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(isoStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

type PostCardProps = {
  post: PostFeed;
  perfisMap: Record<string, string>;
  userId: string;
};

export function PostCard({ post, perfisMap, userId }: PostCardProps) {
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [curtidoPorMim, setCurtidoPorMim] = useState(post.curtido_por_mim);
  const [menuAberto, setMenuAberto] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ehAutor = post.user_id === userId;

  async function handleCurtida() {
    setCurtidoPorMim((v) => !v);
    setCurtidas((c) => (curtidoPorMim ? c - 1 : c + 1));
    await alternarCurtida(post.id);
  }

  async function handleDeletar() {
    setDeletando(true);
    await deletarPost(post.id);
  }

  const avatarUrl = post.autor.avatar_url ?? avatarPadrao(post.user_id);

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Link href={`/perfil/${post.user_id}`} className="shrink-0">
          <img
            src={avatarUrl}
            alt={post.autor.apelido}
            width={36}
            height={36}
            className="rounded-full"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <Link
                href={`/perfil/${post.user_id}`}
                className="font-semibold hover:underline"
              >
                {post.autor.apelido}
              </Link>
              <span className="text-muted-foreground">·</span>
              <time
                dateTime={post.created_at}
                className="text-muted-foreground"
              >
                {tempoRelativo(post.created_at)}
              </time>
            </div>
            {ehAutor && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuAberto((v) => !v)}
                  aria-label="Opções do post"
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
                {menuAberto && (
                  <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-xl border border-border bg-card shadow-lg">
                    <button
                      onClick={handleDeletar}
                      disabled={deletando}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-muted disabled:opacity-50 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {deletando ? "Deletando..." : "Deletar post"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mb-2 break-words text-sm leading-relaxed">
            <MencaoLink conteudo={post.conteudo} perfis={perfisMap} />
          </p>

          {post.jogo && (
            <Link
              href="/jogos"
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {post.jogo.bandeira_casa && (
                <img src={post.jogo.bandeira_casa} alt="" width={14} height={10} />
              )}
              <span>{post.jogo.time_casa} × {post.jogo.time_fora}</span>
              {post.jogo.bandeira_fora && (
                <img src={post.jogo.bandeira_fora} alt="" width={14} height={10} />
              )}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={handleCurtida}
              aria-label="Curtir"
              aria-pressed={curtidoPorMim}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-colors hover:bg-muted ${
                curtidoPorMim ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <Heart
                className="h-4 w-4"
                fill={curtidoPorMim ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span>{curtidas}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
