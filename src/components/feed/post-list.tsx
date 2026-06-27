"use client";

import { useState, useTransition } from "react";
import { PostCard } from "./post-card";
import { carregarMaisPosts } from "@/app/feed/actions";
import type { PostFeed } from "@/lib/feed";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

type PostListProps = {
  postsIniciais: PostFeed[];
  perfisMap: Record<string, string>;
  userId: string;
};

export function PostList({ postsIniciais, perfisMap, userId }: PostListProps) {
  const [posts, setPosts] = useState(postsIniciais);
  const [offset, setOffset] = useState(postsIniciais.length);
  const [temMais, setTemMais] = useState(postsIniciais.length === PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  function handleCarregarMais() {
    startTransition(async () => {
      const novos = await carregarMaisPosts(offset, userId);
      setPosts((prev) => [...prev, ...novos]);
      setOffset((o) => o + novos.length);
      if (novos.length < PAGE_SIZE) setTemMais(false);
    });
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum post ainda. Seja o primeiro a postar!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} perfisMap={perfisMap} userId={userId} />
      ))}
      {temMais && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCarregarMais}
            disabled={isPending}
          >
            {isPending ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
