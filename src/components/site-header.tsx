import Link from "next/link";
import { Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
            Cravou!
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/entrar" className={buttonVariants("primary", "sm")}>
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}
