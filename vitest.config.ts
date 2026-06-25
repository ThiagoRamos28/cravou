import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    fakeTimers: {
      // Necessário para userEvent.setup({ advanceTimers }) funcionar corretamente
      // com vi.useFakeTimers() no Vitest 4 + @testing-library/user-event 14.
      shouldAdvanceTime: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mock framer-motion em testes para evitar loops de requestAnimationFrame
      "framer-motion": path.resolve(__dirname, "./src/__mocks__/framer-motion.tsx"),
    },
  },
});
