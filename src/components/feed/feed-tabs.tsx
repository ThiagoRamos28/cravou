"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedTabs() {
  const pathname = usePathname();
  const abaAtiva = pathname === "/feed/palpites" ? "palpites" : "posts";

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
      <Link
        href="/feed"
        className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
          abaAtiva === "posts"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Posts
      </Link>
      <Link
        href="/feed/palpites"
        className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
          abaAtiva === "palpites"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Palpites
      </Link>
    </div>
  );
}
