import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
        <h1 className="text-balance text-4xl font-extrabold sm:text-5xl">
          Cravou! — o bolão da Copa
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Registre seus palpites, acompanhe os jogos e suba no ranking.
        </p>
      </main>
    </div>
  );
}
