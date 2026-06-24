import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  it("exibe a marca Cravou!", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <SiteHeader />
      </ThemeProvider>
    );
    expect(screen.getByText("Cravou!")).toBeInTheDocument();
  });
});
