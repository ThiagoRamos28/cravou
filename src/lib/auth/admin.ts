import { redirect } from "next/navigation";
import { getPerfil, type Profile } from "@/lib/auth/profile";

export async function requireAdmin(): Promise<Profile> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/entrar");
  if (!perfil.is_admin) redirect("/");
  return perfil;
}
