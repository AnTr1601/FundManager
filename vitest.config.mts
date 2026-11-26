import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Lớp miền thuần chạy trong môi trường node (không cần DOM).
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    // Map alias @/* -> src/* khớp với tsconfig, không cần plugin.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
