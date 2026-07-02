"use client";

import { useRouter, usePathname } from "next/navigation";

function chip(ativo: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/70"
  }`;
}

export function JogosFiltro({
  soAbertos = false,
  soEncerrados = false,
}: {
  soAbertos?: boolean;
  soEncerrados?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function toggleAbertos() {
    const params = new URLSearchParams();
    if (soAbertos) {
      params.set("soAbertos", "0"); // opt-out do padrão — mostra todos
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleEncerrados() {
    const params = new URLSearchParams();
    if (!soEncerrados) params.set("encerrados", "1");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar jogos">
      <button
        type="button"
        onClick={toggleAbertos}
        aria-current={soAbertos ? "true" : undefined}
        className={chip(soAbertos)}
      >
        Abertos
      </button>

      <button
        type="button"
        onClick={toggleEncerrados}
        aria-current={soEncerrados ? "true" : undefined}
        className={chip(soEncerrados)}
      >
        Encerrados
      </button>
    </div>
  );
}
