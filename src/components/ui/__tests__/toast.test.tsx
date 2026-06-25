import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";

function GatilhoToast({ message, variant }: { message: string; variant: "success" | "error" }) {
  const { toast } = useToast();
  return <button onClick={() => toast({ message, variant })}>disparar</button>;
}

function Setup({ message = "Palpite salvo!", variant = "success" as const } = {}) {
  return (
    <ToastProvider>
      <GatilhoToast message={message} variant={variant} />
      <Toaster />
    </ToastProvider>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe mensagem de sucesso ao disparar o toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpite salvo!" variant="success" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpite salvo!")).toBeInTheDocument();
  });

  it("exibe mensagem de erro ao disparar toast de erro", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpites encerrados." variant="error" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpites encerrados.")).toBeInTheDocument();
  });

  it("remove o toast automaticamente após 4000 ms", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Setup message="Palpite salvo!" />);
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(screen.getByText("Palpite salvo!")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText("Palpite salvo!")).not.toBeInTheDocument();
  });

  it("container tem role status para acessibilidade", () => {
    render(<Setup />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
