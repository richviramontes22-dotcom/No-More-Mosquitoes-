import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["client/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["reports/**", "dist/**", "node_modules/**"],
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
