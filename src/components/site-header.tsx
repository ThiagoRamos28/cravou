import Link from "next/link";
import { Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { getPerfil } from "@/lib/auth/profile";
import { avatarPadrao } from "@/lib/avatars";

export function HeaderBrand() {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors group-hover:bg-primary/90">
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
        Cravou!
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  const perfil = await getPerfil();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <HeaderBrand />
          {perfil && (
            <nav className="flex items-center gap-0.5 sm:gap-1">
              <Link
                href="/jogos"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Jogos
              </Link>
              <Link
                href="/ranking"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Ranking
              </Link>
              <Link
                href="/historico"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Histórico
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {perfil ? (
            <UserMenu
              apelido={perfil.apelido ?? "Você"}
              avatarUrl={perfil.avatar_url ?? avatarPadrao(perfil.id)}
            />
          ) : (
            <Link href="/entrar" className={buttonVariants("primary", "sm")}>
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
