import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/admin";
import { listarJogos } from "@/lib/matches";
import { MatchAdminRow } from "@/components/admin/match-admin-row";
import { dispararSync } from "@/app/admin/actions";
import { Button, buttonVariants } from "@/components/ui/button";

async function handleDispararSync() {
  "use server";
  await dispararSync();
}

export default async function AdminPage() {
  await requireAdmin();
  const jogos = await listarJogos();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Admin</h1>
          <div className="flex items-center gap-2">
            <a href="/admin/auditoria" className={buttonVariants("ghost", "sm")}>
              Auditoria
            </a>
            <a href="/admin/config" className={buttonVariants("ghost", "sm")}>
              Configurações
            </a>
            <form action={handleDispararSync}>
              <Button type="submit" variant="primary" size="sm">
                Sincronizar agora
              </Button>
            </form>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Corrigir um placar manualmente marca o jogo como definitivo e a sincronização
          automática deixa de sobrescrevê-lo.
        </p>
        <div className="flex flex-col gap-2">
          {jogos.map((j) => (
            <MatchAdminRow key={j.id} match={j} />
          ))}
        </div>
      </main>
    </div>
  );
}
