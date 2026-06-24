import { describe, it, expect, beforeEach } from "vitest";

describe("createClient (browser)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("cria um client com método from()", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    expect(typeof supabase.from).toBe("function");
  });
});
