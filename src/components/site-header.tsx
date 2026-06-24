import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <span className="text-2xl font-extrabold tracking-tight text-primary">
          Cravou!
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
