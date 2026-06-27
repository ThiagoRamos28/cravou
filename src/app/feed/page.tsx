import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarPosts, listarPerfis, listarJogosParaComposer } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PostComposer } from "@/components/feed/post-composer";
import { PostList } from "@/components/feed/post-list";

export default async function FeedPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const [posts, perfis, jogos] = await Promise.all([
    listarPosts(sessao.userId),
    listarPerfis(),
    listarJogosParaComposer(),
  ]);

  const perfisMap: Record<string, string> = {};
  for (const p of perfis) {
    if (p.apelido) perfisMap[p.apelido] = p.id;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Feed
        </h1>
        <div className="flex flex-col gap-4">
          <PostComposer jogos={jogos} perfis={perfis} />
          <PostList
            postsIniciais={posts}
            perfisMap={perfisMap}
            userId={sessao.userId}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
