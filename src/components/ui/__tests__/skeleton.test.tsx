import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renderiza com animate-pulse e bg-muted", () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("bg-muted");
  });

  it("aplica className adicional recebido via prop", () => {
    render(<Skeleton className="h-4 w-20" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveClass("h-4", "w-20");
  });
});
