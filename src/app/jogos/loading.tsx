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

function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-12" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mt-3">
        <Skeleton className="h-9 w-52" />
      </div>
    </div>
  );
}

export default function JogosLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-9 w-44" />
        <Skeleton className="mb-6 h-8 w-full max-w-sm" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
