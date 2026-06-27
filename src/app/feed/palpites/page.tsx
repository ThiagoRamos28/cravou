import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth/profile";
import { listarPalpitesAmigos } from "@/lib/feed";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { PalpitesAmigosList } from "@/components/feed/palpites-amigos-list";

export default async function FeedPalpitesPage() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");

  const palpites = await listarPalpitesAmigos(sessao.userId);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-tight">
          Feed
        </h1>
        <div className="flex flex-col gap-4">
          <FeedTabs />
          <PalpitesAmigosList
            palpitesIniciais={palpites}
            userId={sessao.userId}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
