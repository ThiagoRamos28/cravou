import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RedefinirSenhaForm } from "./form";

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12 text-foreground">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-display text-2xl font-bold uppercase tracking-tight">
          Cravou!
        </span>
      </Link>
      <RedefinirSenhaForm />
    </main>
  );
}
