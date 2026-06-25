import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireAdmin } from "@/lib/auth/admin";
import { listarConfig } from "@/lib/config";
import { ConfigForm } from "@/components/admin/config-form";

export default async function AdminConfigPage() {
  await requireAdmin();
  const config = await listarConfig();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-display mb-6 text-3xl font-bold uppercase tracking-tight">
          Configurações
        </h1>
        <ConfigForm config={config} />
      </main>
      <SiteFooter />
    </div>
  );
}
