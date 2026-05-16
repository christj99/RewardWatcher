import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5174,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    globals: true,
  },
});
