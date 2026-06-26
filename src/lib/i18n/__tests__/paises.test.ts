import { describe, it, expect } from "vitest";
import { traduzirPais } from "@/lib/i18n/paises";

describe("traduzirPais", () => {
  it("traduz Brazil para Brasil", () => {
    expect(traduzirPais("Brazil")).toBe("Brasil");
  });
  it("traduz France para França", () => {
    expect(traduzirPais("France")).toBe("França");
  });
  it("traduz Germany para Alemanha", () => {
    expect(traduzirPais("Germany")).toBe("Alemanha");
  });
  it("retorna o nome original quando não há tradução", () => {
    expect(traduzirPais("UnknownCountry")).toBe("UnknownCountry");
  });
  it("é case-sensitive", () => {
    expect(traduzirPais("brazil")).toBe("brazil");
  });
});
