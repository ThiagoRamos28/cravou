import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostCard } from "../post-card";
import type { PostFeed } from "@/lib/feed";

vi.mock("@/app/feed/actions", () => ({
  alternarCurtida: vi.fn().mockResolvedValue(undefined),
  deletarPost: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const post: PostFeed = {
  id: "post-1",
  user_id: "user-1",
  conteudo: "Vamos Brasil!",
  created_at: new Date().toISOString(),
  jogo_id: null,
  curtidas: 3,
  curtido_por_mim: false,
  autor: { apelido: "Thiago", avatar_url: null },
  jogo: null,
};

describe("PostCard", () => {
  it("exibe conteúdo do post", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("Vamos Brasil!")).toBeTruthy();
  });

  it("exibe apelido do autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("Thiago")).toBeTruthy();
  });

  it("exibe contagem de curtidas", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("não mostra botão deletar para não-autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    expect(screen.queryByRole("button", { name: /deletar/i })).toBeNull();
  });

  it("mostra menu deletar para o autor", () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-1" />);
    expect(screen.getByLabelText(/opções do post/i)).toBeTruthy();
  });

  it("atualiza curtidas otimistamente ao clicar", async () => {
    render(<PostCard post={post} perfisMap={{}} userId="user-2" />);
    const btn = screen.getByRole("button", { name: /curtir/i });
    await userEvent.click(btn);
    expect(screen.getByText("4")).toBeTruthy();
  });
});
