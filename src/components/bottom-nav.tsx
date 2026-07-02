"use client";

import Link from "next/link";
import { CalendarDays, Trophy, MessageSquare, Users } from "lucide-react";
import { useRotaAtiva } from "@/lib/nav";

const ABAS = [
  { href: "/jogos", label: "Jogos", Icon: CalendarDays },
  { href: "/ranking", label: "Ranking", Icon: Trophy },
  { href: "/feed", label: "Feed", Icon: MessageSquare },
  { href: "/pessoas", label: "Pessoas", Icon: Users },
] as const;

function Aba({ href, label, Icon }: (typeof ABAS)[number]) {
  const ativa = useRotaAtiva(href);
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
        ativa ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      {ABAS.map((aba) => (
        <Aba key={aba.href} {...aba} />
      ))}
    </nav>
  );
}
