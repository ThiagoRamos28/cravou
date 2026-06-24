import { LogOut } from "lucide-react";

export function UserMenu({
  apelido,
  avatarUrl,
}: {
  apelido: string;
  avatarUrl: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full bg-muted"
        />
        <span className="hidden text-sm font-medium sm:inline">{apelido}</span>
      </span>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          aria-label="Sair"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
