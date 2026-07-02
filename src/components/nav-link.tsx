"use client";

import Link from "next/link";
import { useRotaAtiva } from "@/lib/nav";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const ativo = useRotaAtiva(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        ativo
          ? "bg-muted font-semibold text-foreground"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}
