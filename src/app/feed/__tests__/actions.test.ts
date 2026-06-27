import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  upsert: mockUpsert,
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from: mockFrom,
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("publicarPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro para conteúdo vazio", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("  ");
    expect(result.erro).toBeTruthy();
  });

  it("retorna erro para conteúdo > 140 chars", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("x".repeat(141));
    expect(result.erro).toBeTruthy();
  });

  it("insere post válido", async () => {
    const { publicarPost } = await import("../actions");
    const result = await publicarPost("Vamos Brasil!");
    expect(result.erro).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ conteudo: "Vamos Brasil!" })
    );
  });
});

describe("deletarPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita deletar post de outro usuário", async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: "outro-user" }, error: null });
    const { deletarPost } = await import("../actions");
    const result = await deletarPost("post-1");
    expect(result.erro).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
