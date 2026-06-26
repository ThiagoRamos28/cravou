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
  jogosAbertosCount = 0,
}: {
  soAbertos?: boolean;
  soEncerrados?: boolean;
  jogosAbertosCount?: number;
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
        className={
          soAbertos
            ? chip(true)
            : "cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        }
      >
        {!soAbertos && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        )}
        Abertos
        {!soAbertos && jogosAbertosCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent-foreground">
            {jogosAbertosCount}
          </span>
        )}
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
