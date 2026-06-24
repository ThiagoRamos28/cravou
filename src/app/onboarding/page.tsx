import { redirect } from "next/navigation";
import { getPerfil } from "@/lib/auth/profile";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");
  if (perfil.apelido) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-foreground">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Quase lá!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Escolha como você vai aparecer no ranking.
        </p>
      </div>
      <OnboardingForm
        avatares={AVATAR_OPTIONS}
        apelidoInicial=""
        avatarInicial={AVATAR_OPTIONS[0]}
      />
    </main>
  );
}
