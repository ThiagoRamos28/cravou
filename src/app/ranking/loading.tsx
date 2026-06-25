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

function PodiumSkeleton() {
  return (
    <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
      {/* 2º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-24 w-full rounded-t-xl" />
      </div>
      {/* 1º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-32 w-full rounded-t-xl" />
      </div>
      {/* 3º */}
      <div className="flex w-24 flex-col items-center sm:w-28">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="mt-2 h-4 w-16" />
        <Skeleton className="mt-1 h-6 w-10" />
        <Skeleton className="mt-2 h-20 w-full rounded-t-xl" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <Skeleton className="h-3 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function RankingLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LoadingHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Skeleton className="mb-8 h-9 w-32" />
        <PodiumSkeleton />
        <TableSkeleton />
      </main>
      <SiteFooter />
    </div>
  );
}
