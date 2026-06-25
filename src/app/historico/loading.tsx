import { HeaderBrand } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderBrand />
        <ThemeToggle />
      </div>
    </header>
  );
}

function ResumoSkeleton() {
  return (
    <div className="mb-6 grid grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 text-center">
          <Skeleton className="mx-auto mb-2 h-5 w-5" />
          <Skeleton className="mx-auto mb-1 h-7 w-12" />
          <Skeleton className="mx-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function HistoricoItemSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Skeleton className="mb-2 h-3 w-28" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-10" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function HistoricoLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-8 h-9 w-44" />
        <ResumoSkeleton />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <HistoricoItemSkeleton key={i} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
