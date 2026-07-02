"use client";

import { usePathname } from "next/navigation";

export function useRotaAtiva(href: string): boolean {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(href + "/");
}
